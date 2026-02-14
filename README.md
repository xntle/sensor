# 🌱 Irrigation Sensor Simulation Pipeline

HOSTED: http://158.69.206.50:3000

Mac simulates 10 soil-moisture sensors + a mesh hub.
VPS runs MQTT broker + real-time signal processing.

```
Mac                                        VPS (158.69.206.50)
─────────────────────────────────────────────────────────────────
sensor_sim.py                           Mosquitto :1883
 10 sensors @ 2 Hz                          │
 ──UDP──▶ hub.py ──MQTT──────────────▶ irrigation/raw/<id>
           (3% drop, 0-500ms jitter)        │
                                       processor.py
                                        median → clamp → EMA
                                        residual noise · OOO guard
                                        status + health classify
                                            │
                                       irrigation/processed/<id>
```

---

## Quick Start

### 1 — Deploy VPS (one command)

```bash
# Copy repo to VPS, then:
docker compose up -d --build
```

### 2 — Tail processor logs

```bash
docker logs -f processor
```

### 3 — Run hub on Mac

```bash
cd mac
python3 hub.py --broker 158.69.206.50
```

### 4 — Run sensors on Mac

```bash
cd mac
python3 sensor_sim.py -n 10 --rate 2
```

---

## Acceptance Test

With all four running, verify on the VPS:

```bash
# Raw messages arriving (~20 msg/s with 10 sensors @ 2 Hz):
mosquitto_sub -h 127.0.0.1 -t 'irrigation/raw/#' -v

# Processed + classified output:
mosquitto_sub -h 127.0.0.1 -t 'irrigation/processed/#' -v

# From Mac (remote check):
mosquitto_sub -h 158.69.206.50 -t 'irrigation/processed/#' -v
```

Expected processor output (every message):

```json
{"sensor_id":"zone03","ts":1739500000.12,"raw":512.4,"median":505.0,"filtered":498.2,"status":"OK","health":["OK"],"noise_score":0.02}
```

Health summary (every 5 seconds):

```
── health │ 10 sensors │ OK=9  NOISY=0  SPIKY=1  STALE=0 │ avg_noise=0.031 ──
```

---

## Data Formats

### Raw (sensor → hub → MQTT)

```json
{"sensor_id":"zone03","ts":1739500000.12,"moisture_raw":512.4,"battery_v":3.91,"temp_c":22.1}
```

### Processed (processor → MQTT)

```json
{"sensor_id":"zone03","ts":1739500000.12,"raw":512.4,"median":505.0,"filtered":498.2,"status":"OK","health":["OK"],"noise_score":0.02}
```

---

## Signal Processing Pipeline

| Stage | What it does | Config |
|-------|-------------|--------|
| **OOO guard** | Drops packets with timestamp > 1s behind last seen | `OOO_SLACK_S = 1.0` |
| **Median filter** | Sliding window median kills spikes | `MEDIAN_WINDOW = 7` |
| **Sanity clamp** | Caps jumps > ±80 between outputs | `MAX_JUMP = 80` |
| **EMA smoothing** | Exponential moving average reduces jitter | `EMA_ALPHA = 0.20` |
| **Residual noise** | Variance of `(raw - filtered)` — immune to irrigation events | `RESIDUAL_WINDOW = 20` |
| **NOISY persist** | Only flags NOISY if high variance for > 3 sec | `NOISY_PERSIST_S = 3.0` |

## Classification

| Status | Condition |
|--------|-----------|
| `DRY` | filtered < 350 |
| `OK` | 350 ≤ filtered ≤ 650 |
| `OVERWATER` | filtered > 650 |

| Health | Condition |
|--------|-----------|
| `OK` | Normal operation |
| `NOISY` | Residual variance high for > 3 sec |
| `SPIKY` | ≥ 3 clamped jumps in last 30 samples |
| `STALE` | No data for > 10 sec |

## Hub Impairments

| Effect | Rate |
|--------|------|
| Packet drop | 3% |
| Jitter | 0–500 ms |
| Out-of-order | 1% (+1 sec delay) |

---

## Dependencies

**Mac** (sensor_sim + hub):

```bash
pip install paho-mqtt
```

**VPS** (Docker handles everything):

```bash
apt install docker.io docker-compose-v2
```

---

## File Layout

```
├── docker-compose.yml          ← deploy VPS with one command
├── mac/
│   ├── sensor_sim.py           ← spawns N virtual sensors (UDP)
│   ├── hub.py                  ← UDP→MQTT forwarder with impairments
│   └── requirements.txt
└── vps/
    ├── processor.py            ← subscribe + filter + classify + republish
    ├── Dockerfile.processor
    ├── mosquitto/config/
    │   └── mosquitto.conf
    └── requirements.txt
```
