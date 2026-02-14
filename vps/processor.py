#!/usr/bin/env python3
"""
processor.py — Signal-processing service for the VPS.

Subscribes to  irrigation/raw/#
For each sensor stream performs:
  • out-of-order rejection (timestamp guard)
  • median filter   (kills spikes)
  • EMA smoothing   (reduces jitter)
  • sanity clamp    (impossible jumps)
  • missing-packet / stale detection
  • residual-based noise score (immune to irrigation events)
  • periodic health summary

Outputs to console and republishes to  irrigation/processed/<sensor_id>
"""

import argparse
import collections
import json
import math
import statistics
import threading
import time

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt is required.  pip install paho-mqtt")
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MEDIAN_WINDOW = 7            # samples
EMA_ALPHA = 0.20             # smoothing factor  (0 < α ≤ 1)  — tuned up from 0.15
MAX_JUMP = 80.0              # clamp if |Δ| > this  — tuned down from 100
STALE_TIMEOUT_S = 10.0       # no data for this long → STALE
OOO_SLACK_S = 1.0            # drop packets older than last_ts by this much

RESIDUAL_WINDOW = 20         # rolling window for residual variance
NOISY_RESIDUAL_THRESH = 60.0 # residual variance above this → NOISY
NOISY_PERSIST_S = 3.0        # must stay noisy for this long to flag

SPIKE_CLAMP_WINDOW = 30      # how many recent samples to count clamps in
SPIKE_CLAMP_THRESH = 3       # clamp count above this → SPIKY

# Moisture thresholds for status classification
MOISTURE_DRY = 350.0
MOISTURE_OVERWATER = 650.0

HEALTH_SUMMARY_INTERVAL_S = 5.0  # print summary every N seconds


# ---------------------------------------------------------------------------
# Per-sensor state
# ---------------------------------------------------------------------------
class SensorState:
    """Holds all processing state for one sensor."""

    def __init__(self, sensor_id: str):
        self.sensor_id = sensor_id
        self.raw_buffer: collections.deque = collections.deque(maxlen=MEDIAN_WINDOW)
        self.residual_buffer: collections.deque = collections.deque(maxlen=RESIDUAL_WINDOW)
        self.clamp_history: collections.deque = collections.deque(maxlen=SPIKE_CLAMP_WINDOW)
        self.ema: float | None = None
        self.last_filtered: float | None = None
        self.last_ts: float = 0.0
        self.total_received: int = 0
        self.total_ooo_dropped: int = 0

        # NOISY persistence tracking
        self.noisy_since: float = 0.0  # wallclock when residual var first exceeded threshold
        self.is_noisy: bool = False

    def try_accept(self, ts: float) -> bool:
        """Return False if the packet is out-of-order beyond the slack window."""
        if self.last_ts > 0 and ts < (self.last_ts - OOO_SLACK_S):
            self.total_ooo_dropped += 1
            return False
        return True

    def process(self, raw: float, ts: float) -> dict:
        self.total_received += 1
        self.last_ts = max(self.last_ts, ts)   # monotonic tracking
        self.raw_buffer.append(raw)

        # ---- median filter ------------------------------------------------
        median_val = statistics.median(self.raw_buffer)

        # ---- sanity clamp -------------------------------------------------
        clamped = False
        if self.last_filtered is not None and abs(median_val - self.last_filtered) > MAX_JUMP:
            median_val = self.last_filtered + math.copysign(MAX_JUMP, median_val - self.last_filtered)
            clamped = True
        self.clamp_history.append(1 if clamped else 0)

        # ---- EMA smoothing ------------------------------------------------
        if self.ema is None:
            self.ema = median_val
        else:
            self.ema = EMA_ALPHA * median_val + (1 - EMA_ALPHA) * self.ema
        filtered = round(self.ema, 2)
        self.last_filtered = filtered

        # ---- residual-based noise score -----------------------------------
        residual = raw - filtered
        self.residual_buffer.append(residual)
        if len(self.residual_buffer) >= 3:
            res_var = statistics.variance(self.residual_buffer)
            noise_score = round(min(res_var / 500.0, 1.0), 3)  # normalise 0-1
        else:
            res_var = 0.0
            noise_score = 0.0

        # ---- NOISY with persistence --------------------------------------
        now = time.time()
        if res_var > NOISY_RESIDUAL_THRESH:
            if self.noisy_since == 0.0:
                self.noisy_since = now
            if (now - self.noisy_since) >= NOISY_PERSIST_S:
                self.is_noisy = True
        else:
            self.noisy_since = 0.0
            self.is_noisy = False

        # ---- health labels -------------------------------------------------
        health = []
        if self.is_noisy:
            health.append("NOISY")
        if sum(self.clamp_history) >= SPIKE_CLAMP_THRESH:
            health.append("SPIKY")
        # STALE is checked externally (timer-based)

        # ---- status classification -----------------------------------------
        if filtered < MOISTURE_DRY:
            status = "DRY"
        elif filtered > MOISTURE_OVERWATER:
            status = "OVERWATER"
        else:
            status = "OK"

        return {
            "sensor_id": self.sensor_id,
            "ts": ts,
            "raw": raw,
            "median": round(median_val, 2),
            "filtered": filtered,
            "status": status,
            "health": health if health else ["OK"],
            "noise_score": noise_score,
        }


# ---------------------------------------------------------------------------
# Stale-sensor checker + health summary
# ---------------------------------------------------------------------------
def check_stale(sensors: dict[str, SensorState]):
    """Print warnings for sensors that haven't reported recently."""
    now = time.time()
    for sid, state in sensors.items():
        gap = now - state.last_ts
        if state.last_ts > 0 and gap > STALE_TIMEOUT_S:
            print(f"  ⚠  [{sid}] STALE — no data for {gap:.1f} s")


def print_health_summary(sensors: dict[str, SensorState]):
    """Print a compact dashboard every few seconds."""
    if not sensors:
        return
    now = time.time()
    ok = noisy = stale = spiky = 0
    scores = []
    for s in sensors.values():
        gap = now - s.last_ts
        if s.last_ts > 0 and gap > STALE_TIMEOUT_S:
            stale += 1
        elif s.is_noisy:
            noisy += 1
        elif sum(s.clamp_history) >= SPIKE_CLAMP_THRESH:
            spiky += 1
        else:
            ok += 1
        # Grab latest noise score from residual buffer
        if len(s.residual_buffer) >= 3:
            scores.append(statistics.variance(s.residual_buffer) / 500.0)
    avg_noise = round(min(sum(scores) / len(scores), 1.0), 3) if scores else 0.0
    total = len(sensors)
    print(
        f"  ── health │ {total} sensors │ OK={ok}  NOISY={noisy}  "
        f"SPIKY={spiky}  STALE={stale} │ avg_noise={avg_noise} ──"
    )


# ---------------------------------------------------------------------------
# MQTT callbacks
# ---------------------------------------------------------------------------
def make_callbacks(sensors: dict[str, SensorState], client_ref: list):
    """Return on_connect and on_message closures."""

    def on_connect(client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            print("[processor] Connected to MQTT broker ✓")
            client.subscribe("irrigation/raw/#", qos=0)
            print("[processor] Subscribed to irrigation/raw/#")
        else:
            print(f"[processor] MQTT connect failed rc={reason_code}")

    def on_message(client, userdata, msg):
        try:
            payload = json.loads(msg.payload)
        except json.JSONDecodeError:
            return

        sensor_id = payload.get("sensor_id", "unknown")
        raw = payload.get("moisture_raw")
        ts = payload.get("ts", time.time())

        if raw is None:
            return

        # Get or create per-sensor state
        if sensor_id not in sensors:
            sensors[sensor_id] = SensorState(sensor_id)
            print(f"[processor] New sensor discovered: {sensor_id}")

        state = sensors[sensor_id]

        # ---- out-of-order rejection -----------------------------------
        if not state.try_accept(float(ts)):
            return  # silently drop stale OOO packet

        result = state.process(float(raw), float(ts))

        # Print to console
        print(f"  → {json.dumps(result)}")

        # Republish processed
        out_topic = f"irrigation/processed/{sensor_id}"
        client.publish(out_topic, json.dumps(result).encode(), qos=0)

    return on_connect, on_message


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Signal-processing service")
    parser.add_argument("--broker", default="127.0.0.1",
                        help="MQTT broker host (default: 127.0.0.1)")
    parser.add_argument("--broker-port", type=int, default=1883,
                        help="MQTT broker port (default: 1883)")
    args = parser.parse_args()

    sensors: dict[str, SensorState] = {}
    client_ref: list = []

    on_connect, on_message = make_callbacks(sensors, client_ref)

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                         client_id="processor-001", protocol=mqtt.MQTTv311)
    client.on_connect = on_connect
    client.on_message = on_message
    client_ref.append(client)

    print(f"[processor] Connecting to broker {args.broker}:{args.broker_port} …")
    client.connect(args.broker, args.broker_port, keepalive=60)

    # Periodic stale check + health summary in background
    import threading

    stop = threading.Event()

    def monitor_loop():
        while not stop.is_set():
            time.sleep(HEALTH_SUMMARY_INTERVAL_S)
            check_stale(sensors)
            print_health_summary(sensors)

    threading.Thread(target=monitor_loop, daemon=True).start()

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[processor] Shutting down …")
        stop.set()
        client.disconnect()
        print("[processor] Done.")


if __name__ == "__main__":
    main()
