#!/usr/bin/env python3
"""
hub.py — Mesh-gateway / hub emulator.

Receives UDP packets from local virtual sensors, then forwards them
to the remote VPS MQTT broker with realistic network impairments:
  • random packet drop  (1–5 %)
  • random delay / jitter (0–500 ms)
  • rare out-of-order delivery
"""

import argparse
import json
import random
import socket
import threading
import time

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("ERROR: paho-mqtt is required.  pip install paho-mqtt")
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# Network-impairment settings
# ---------------------------------------------------------------------------
DROP_RATE = 0.03          # 3 % packet drop
MAX_JITTER_S = 0.5        # up to 500 ms jitter
OOO_PROBABILITY = 0.01    # 1 % chance of out-of-order (extra delay)
OOO_EXTRA_S = 1.0          # extra delay when OOO triggers


# ---------------------------------------------------------------------------
# MQTT helper
# ---------------------------------------------------------------------------
class MQTTForwarder:
    """Maintains one MQTT connection to the VPS broker."""

    def __init__(self, broker_host: str, broker_port: int):
        self.client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"hub-{random.randint(1000,9999)}",
            protocol=mqtt.MQTTv311,
        )
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.broker_host = broker_host
        self.broker_port = broker_port
        self._connected = False

    def connect(self):
        print(f"[hub] Connecting to MQTT broker at {self.broker_host}:{self.broker_port} …")
        self.client.reconnect_delay_set(min_delay=1, max_delay=10)
        self.client.connect(self.broker_host, self.broker_port, keepalive=30)
        self.client.loop_start()

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self._connected = True
            print("[hub] MQTT connected ✓")
        else:
            print(f"[hub] MQTT connect failed, rc={reason_code}")

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self._connected = False
        print(f"[hub] MQTT disconnected (rc={reason_code}), will auto-reconnect")

    def publish(self, topic: str, payload: bytes) -> bool:
        if self._connected:
            info = self.client.publish(topic, payload, qos=0)
            return info.rc == mqtt.MQTT_ERR_SUCCESS
        return False

    def stop(self):
        self.client.loop_stop()
        self.client.disconnect()


# ---------------------------------------------------------------------------
# Impairment + forwarding
# ---------------------------------------------------------------------------
def forward_with_impairments(forwarder: MQTTForwarder, raw: bytes, stats: dict):
    """Apply drop / jitter / OOO and then publish via MQTT."""
    stats["received"] += 1

    # --- drop ---
    if random.random() < DROP_RATE:
        stats["dropped"] += 1
        return

    # --- jitter / delay ---
    delay = random.uniform(0, MAX_JITTER_S)

    # --- out-of-order (extra delay) ---
    if random.random() < OOO_PROBABILITY:
        delay += OOO_EXTRA_S
        stats["ooo"] += 1

    def _do_publish():
        try:
            msg = json.loads(raw)
            sensor_id = msg.get("sensor_id", "unknown")
            topic = f"irrigation/raw/{sensor_id}"
            ok = forwarder.publish(topic, raw)
            if ok:
                stats["forwarded"] += 1
            else:
                stats["pub_fail"] = stats.get("pub_fail", 0) + 1
        except Exception as exc:
            print(f"[hub] publish error: {exc}")

    if delay < 0.005:
        _do_publish()
    else:
        t = threading.Timer(delay, _do_publish)
        t.daemon = True
        t.start()


# ---------------------------------------------------------------------------
# Stats printer
# ---------------------------------------------------------------------------
def stats_printer(stats: dict, stop_event: threading.Event):
    """Print forwarding stats every 5 seconds."""
    while not stop_event.is_set():
        time.sleep(5)
        pf = stats.get("pub_fail", 0)
        print(
            f"[hub] stats | recv={stats['received']}  fwd={stats['forwarded']}  "
            f"drop={stats['dropped']}  ooo={stats['ooo']}  pub_fail={pf}"
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Hub emulator — UDP→MQTT forwarder")
    parser.add_argument("--udp-host", default="0.0.0.0",
                        help="UDP listen address (default: 0.0.0.0)")
    parser.add_argument("--udp-port", type=int, default=9900,
                        help="UDP listen port (default: 9900)")
    parser.add_argument("--broker", default="158.69.206.50",
                        help="MQTT broker host (default: 158.69.206.50)")
    parser.add_argument("--broker-port", type=int, default=1883,
                        help="MQTT broker port (default: 1883)")
    args = parser.parse_args()

    # ---- MQTT ----
    forwarder = MQTTForwarder(args.broker, args.broker_port)
    forwarder.connect()

    # Wait briefly for connection
    time.sleep(2)

    # ---- UDP listener ----
    udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    udp_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    udp_sock.bind((args.udp_host, args.udp_port))
    udp_sock.settimeout(1.0)

    print(f"[hub] Listening for sensor UDP on {args.udp_host}:{args.udp_port}")

    stats = {"received": 0, "forwarded": 0, "dropped": 0, "ooo": 0}
    stop = threading.Event()

    st = threading.Thread(target=stats_printer, args=(stats, stop), daemon=True)
    st.start()

    try:
        while True:
            try:
                data, addr = udp_sock.recvfrom(4096)
            except socket.timeout:
                continue
            forward_with_impairments(forwarder, data, stats)
    except KeyboardInterrupt:
        print("\n[hub] Shutting down …")
        stop.set()
        forwarder.stop()
        udp_sock.close()
        print("[hub] Done.")


if __name__ == "__main__":
    main()
