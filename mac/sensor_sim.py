#!/usr/bin/env python3
"""
sensor_sim.py — Spawns N virtual irrigation moisture sensors.

Each sensor generates a moisture-like signal with:
  • baseline value
  • Gaussian noise
  • occasional spikes / outliers
  • slow drift over time
  • irrigation events (step increase + exponential decay)

Sends JSON packets over UDP to the local hub.
"""

import argparse
import json
import math
import random
import socket
import threading
import time

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None  # MQTT command channel is optional


# ---------------------------------------------------------------------------
# Sensor model
# ---------------------------------------------------------------------------
class VirtualSensor:
    """Simulates one soil-moisture sensor."""

    def __init__(self, sensor_id: str, baseline: float = 500.0):
        self.sensor_id = sensor_id
        self.baseline = baseline
        self.moisture = baseline

        # Noise parameters
        self.noise_std = 3.0            # Gaussian noise σ  (was 4.0)
        self.spike_prob = 0.015         # probability of an outlier per tick
        self.spike_mag = (60.0, 150.0)  # outlier magnitude range (was 80–200)

        # Drift
        self.drift_rate = 0.0           # units / sec (set randomly)
        self._randomise_drift()

        # Irrigation event state
        self.irr_amplitude = 0.0
        self.irr_tau = 60.0             # decay time-constant (seconds)
        self.irr_prob = 0.005           # probability of triggering irrigation per tick (was 0.003)

        # Battery / temperature (cosmetic)
        self.battery_v = round(random.uniform(3.6, 4.2), 2)
        self.temp_c = round(random.uniform(18.0, 30.0), 1)

    # --- helpers -----------------------------------------------------------
    def _randomise_drift(self):
        """Pick a slow random drift direction."""
        self.drift_rate = random.uniform(-0.15, 0.15)  # gentler (was ±0.5)

    def tick(self, dt: float) -> dict:
        """Advance the sensor by *dt* seconds and return a reading."""
        # Drift
        self.moisture += self.drift_rate * dt

        # Irrigation event — step up + exponential decay
        if random.random() < self.irr_prob:
            self.irr_amplitude += random.uniform(80, 150)
        if self.irr_amplitude > 0.1:
            self.moisture += self.irr_amplitude * (1 - math.exp(-dt / self.irr_tau))
            self.irr_amplitude *= math.exp(-dt / self.irr_tau)

        # Gaussian noise
        noise = random.gauss(0, self.noise_std)

        # Occasional spike
        spike = 0.0
        if random.random() < self.spike_prob:
            spike = random.choice([-1, 1]) * random.uniform(*self.spike_mag)

        raw = self.moisture + noise + spike

        # Battery drain (very slow)
        self.battery_v = max(3.0, self.battery_v - random.uniform(0, 0.0001))

        # Temperature wander
        self.temp_c += random.uniform(-0.05, 0.05)

        return {
            "sensor_id": self.sensor_id,
            "ts": round(time.time(), 3),
            "moisture_raw": round(raw, 2),
            "battery_v": round(self.battery_v, 2),
            "temp_c": round(self.temp_c, 1),
        }


# ---------------------------------------------------------------------------
# Sensor thread
# ---------------------------------------------------------------------------
def sensor_loop(sensor: VirtualSensor, rate_hz: float,
                udp_sock: socket.socket, hub_addr: tuple,
                stop_event: threading.Event):
    """Run one sensor at *rate_hz* Hz, sending UDP datagrams to *hub_addr*."""
    interval = 1.0 / rate_hz
    while not stop_event.is_set():
        pkt = sensor.tick(interval)
        data = json.dumps(pkt).encode()
        try:
            udp_sock.sendto(data, hub_addr)
        except OSError as exc:
            print(f"[sensor_sim] send error ({sensor.sensor_id}): {exc}")
        time.sleep(interval)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Virtual irrigation sensor simulator")
    parser.add_argument("-n", "--num-sensors", type=int, default=10,
                        help="Number of virtual sensors (default: 10)")
    parser.add_argument("--rate", type=float, default=2.0,
                        help="Samples per second per sensor (default: 2 Hz)")
    parser.add_argument("--hub-host", default="127.0.0.1",
                        help="Hub UDP listen address (default: 127.0.0.1)")
    parser.add_argument("--hub-port", type=int, default=9900,
                        help="Hub UDP listen port (default: 9900)")
    parser.add_argument("--broker", default=None,
                        help="MQTT broker for command channel (enables dynamic sensor creation)")
    parser.add_argument("--broker-port", type=int, default=1883,
                        help="MQTT broker port (default: 1883)")
    args = parser.parse_args()

    hub_addr = (args.hub_host, args.hub_port)
    udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    stop = threading.Event()

    sensors = []
    threads = []
    next_sensor_idx = args.num_sensors  # for generating unique IDs

    print(f"[sensor_sim] Spawning {args.num_sensors} sensors → hub at {hub_addr}  @ {args.rate} Hz")

    for i in range(args.num_sensors):
        sid = f"zone{i:02d}"
        baseline = random.uniform(350, 650)
        s = VirtualSensor(sensor_id=sid, baseline=baseline)
        sensors.append(s)

        t = threading.Thread(target=sensor_loop, args=(s, args.rate, udp_sock, hub_addr, stop),
                             daemon=True, name=f"sensor-{sid}")
        t.start()
        threads.append(t)

    # ── MQTT command channel for dynamic sensor creation ──────────────
    def spawn_sensor(sensor_id: str, baseline: float = 500.0):
        """Create and start a new sensor at runtime."""
        nonlocal next_sensor_idx
        s = VirtualSensor(sensor_id=sensor_id, baseline=baseline)
        sensors.append(s)
        t = threading.Thread(target=sensor_loop, args=(s, args.rate, udp_sock, hub_addr, stop),
                             daemon=True, name=f"sensor-{sensor_id}")
        t.start()
        threads.append(t)
        next_sensor_idx += 1
        print(f"[sensor_sim] ✚ Spawned new sensor: {sensor_id} (baseline={baseline:.0f})")

    if args.broker and mqtt:
        def on_connect(client, userdata, flags, reason_code, properties=None):
            if reason_code == 0:
                client.subscribe("irrigation/command/#", qos=0)
                print(f"[sensor_sim] MQTT command channel connected → {args.broker}")
            else:
                print(f"[sensor_sim] MQTT connect failed: {reason_code}")

        def on_message(client, userdata, msg):
            try:
                payload = json.loads(msg.payload)
            except json.JSONDecodeError:
                return

            if msg.topic == "irrigation/command/create":
                sid = payload.get("sensor_id")
                if not sid:
                    sid = f"zone{next_sensor_idx:02d}"
                baseline = payload.get("baseline", random.uniform(350, 650))
                # Don't create duplicates
                existing_ids = {s.sensor_id for s in sensors}
                if sid in existing_ids:
                    print(f"[sensor_sim] Sensor {sid} already exists, skipping")
                    return
                spawn_sensor(sid, baseline)

        mclient = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                              client_id="sensor-sim-cmd", protocol=mqtt.MQTTv311)
        mclient.on_connect = on_connect
        mclient.on_message = on_message
        mclient.connect(args.broker, args.broker_port, keepalive=60)
        mclient.loop_start()
    elif args.broker and not mqtt:
        print("[sensor_sim] ⚠ paho-mqtt not installed — command channel disabled")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[sensor_sim] Shutting down …")
        stop.set()
        for t in threads:
            t.join(timeout=2)
        udp_sock.close()
        print("[sensor_sim] Done.")


if __name__ == "__main__":
    main()
