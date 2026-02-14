/**
 * live.ts — Adapter that maps real-time MQTT processor output
 * into the frontend's Block / Sensor / Reading types.
 *
 * The processor sends simple numeric values (raw ADC-ish units, 0–1000).
 * The frontend expects fractional moisture (0–1), weather data, crop info, etc.
 *
 * Strategy:
 *   • Each virtual sensor maps to a "block" on the map.
 *   • Moisture is normalised:  fraction = clamp(value / 1000, 0, 1)
 *   • Status / health / noise_score from the processor drive risk_flags + decision.
 *   • Weather, crop, irrigation, ET use sensible defaults
 *     (in a real deployment these would come from separate data sources).
 */

import type {
  Block,
  Sensor,
  Reading,
  Decision,
  RiskFlag,
  WeatherConditions,
  CropInfo,
  IrrigationHistory,
  ETData,
  SoilType,
} from "@/types";
import type { ProcessedMessage } from "@/hooks/useMQTT";

// ── Geometry: arrange sensors in a grid south of Sievers Rd, Dixon CA ─────
const CENTER: [number, number] = [-121.8168, 38.4855];
const BLOCK_W = 0.005;   // ~0.005° longitude ≈ 440 m
const BLOCK_H = 0.0015;  // ~0.0015° latitude  ≈ 167 m
const COLS = 4;

function blockGeometry(index: number): GeoJSON.Polygon {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const west = CENTER[0] - (COLS / 2) * BLOCK_W + col * BLOCK_W;
  const east = west + BLOCK_W;
  const north = CENTER[1] + 0.003 - row * BLOCK_H;
  const south = north - BLOCK_H;
  return {
    type: "Polygon",
    coordinates: [[
      [west, north], [east, north], [east, south], [west, south], [west, north],
    ]],
  };
}

function sensorLatLng(index: number): { lat: number; lng: number } {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    lng: CENTER[0] - (COLS / 2) * BLOCK_W + col * BLOCK_W + BLOCK_W / 2,
    lat: CENTER[1] + 0.003 - row * BLOCK_H - BLOCK_H / 2,
  };
}

// ── Defaults for fields the processor doesn't supply ──────────────────────
const SOIL_TYPES: SoilType[] = [
  "silt_loam", "clay_loam", "sandy_loam", "loam", "clay",
  "sand", "silt_loam", "clay_loam", "sandy_loam", "loam",
];

const CROPS = [
  "Tomatoes", "Lettuce", "Peppers", "Squash", "Corn",
  "Almonds", "Grapes", "Onions", "Strawberries", "Carrots",
];

const DEFAULT_WEATHER: WeatherConditions = {
  temperature: 88,
  humidity: 35,
  wind_speed: 10,
  solar_radiation: 800,
  rain_forecast_24h: 0,
  rain_last_24h: 0,
};

function defaultCrop(index: number): CropInfo {
  return {
    crop: CROPS[index % CROPS.length],
    stage: "vegetative",
    days_in_stage: 14,
    water_sensitivity: "moderate",
  };
}

function defaultIrrigation(): IrrigationHistory {
  return {
    last_irrigation: new Date(Date.now() - 24 * 3600_000).toISOString(),
    hours_since: 24,
    amount_gallons: 8000,
    method: "drip",
    pump_runtime_min: 120,
  };
}

function defaultET(): ETData {
  return { et_today: 0.22, et_7day_avg: 0.25, water_balance: -0.15 };
}

// ── Core mapping ──────────────────────────────────────────────────────────

/** Normalise ADC-ish value (0–1000) to fractional moisture (0–1). */
function normaliseMoisture(adcValue: number): number {
  return Math.max(0, Math.min(1, adcValue / 1000));
}

/** Map processor status + health to frontend decision / flags. */
function deriveDecision(
  moistureFrac: number,
  status: string,
  health: string[],
  noiseScore: number,
): { decision: Decision; reason: string; riskFlags: RiskFlag[]; confidence: number } {
  const flags: RiskFlag[] = [];
  let confidence = 0.9;

  // Health-based flags
  if (health.includes("NOISY")) {
    flags.push("sensor_suspect");
    confidence -= 0.25;
  }
  if (health.includes("SPIKY")) {
    flags.push("anomaly_detected");
    confidence -= 0.2;
  }
  if (health.includes("STALE")) {
    flags.push("sensor_offline");
    confidence -= 0.35;
  }

  // Noise score degrades confidence
  confidence -= noiseScore * 0.15;
  confidence = Math.max(0.1, Math.min(1, confidence));

  // Decision logic
  let decision: Decision;
  let reason: string;

  if (status === "DRY" || moistureFrac < 0.35) {
    decision = "IRRIGATE";
    reason = `Soil moisture low (${Math.round(moistureFrac * 100)}%). `;
  } else {
    decision = "WAIT";
    reason = `Moisture adequate (${Math.round(moistureFrac * 100)}%). `;
  }

  if (flags.length > 0) {
    reason += `Flags: ${flags.join(", ")}. Verify before acting.`;
    if (confidence < 0.5) flags.push("needs_check");
  }

  return { decision, reason, riskFlags: flags, confidence: Math.round(confidence * 100) / 100 };
}

// ── Public interface: LiveStore ───────────────────────────────────────────

export interface SensorSnapshot {
  raw: number;
  filtered: number;
  status: string;
  health: string[];
  noiseScore: number;
  ts: number;
}

/**
 * Stateful store that accumulates ProcessedMessages and
 * produces Block[] / Sensor[] / Reading[] snapshots for the UI.
 */
export class LiveStore {
  private sensorIndex = new Map<string, number>();   // sensor_id → positional index
  private latest = new Map<string, SensorSnapshot>();
  private nextIndex = 0;

  /** Ingest one processed MQTT message. */
  ingest(msg: ProcessedMessage): void {
    if (!this.sensorIndex.has(msg.sensor_id)) {
      this.sensorIndex.set(msg.sensor_id, this.nextIndex++);
    }
    this.latest.set(msg.sensor_id, {
      raw: msg.raw,
      filtered: msg.filtered,
      status: msg.status,
      health: msg.health,
      noiseScore: msg.noise_score,
      ts: msg.ts,
    });
  }

  /** Generate the Block array for the current snapshot. */
  getBlocks(): Block[] {
    const blocks: Block[] = [];
    this.sensorIndex.forEach((idx, sensorId) => {
      const snap = this.latest.get(sensorId);
      if (!snap) return;

      const moistureNow = normaliseMoisture(snap.filtered);
      const moistureRaw = normaliseMoisture(snap.raw);
      const { decision, reason, riskFlags, confidence } = deriveDecision(
        moistureNow, snap.status, snap.health, snap.noiseScore,
      );

      blocks.push({
        id: `block-${sensorId}`,
        name: `Sensor ${sensorId}`,
        geometry: blockGeometry(idx),
        soil_type: SOIL_TYPES[idx % SOIL_TYPES.length],
        moisture_now: moistureNow,
        moisture_raw: moistureRaw,
        confidence,
        decision,
        reason,
        risk_flags: riskFlags,
        last_updated: new Date(snap.ts * 1000).toISOString(),
        weather: DEFAULT_WEATHER,
        crop: defaultCrop(idx),
        irrigation: defaultIrrigation(),
        et: defaultET(),
      });
    });
    return blocks;
  }

  /** Generate the Sensor array for the current snapshot. */
  getSensors(): Sensor[] {
    const sensors: Sensor[] = [];
    this.sensorIndex.forEach((idx, sensorId) => {
      const snap = this.latest.get(sensorId);
      const { lat, lng } = sensorLatLng(idx);
      sensors.push({
        sensor_id: sensorId,
        type: "soil",
        lat,
        lng,
        block_id: `block-${sensorId}`,
        status: snap && snap.health.includes("STALE") ? "offline" : "online",
      });
    });
    return sensors;
  }

  /** Generate the Reading array for the current snapshot. */
  getReadings(): Reading[] {
    const readings: Reading[] = [];
    this.latest.forEach((snap, sensorId) => {
      readings.push({
        sensor_id: sensorId,
        timestamp: new Date(snap.ts * 1000).toISOString(),
        moisture_raw: normaliseMoisture(snap.raw),
        moisture_corrected: normaliseMoisture(snap.filtered),
        temperature: 22,   // placeholder — processor doesn't send temp
        humidity: 55,       // placeholder
      });
    });
    return readings;
  }

  get sensorCount(): number {
    return this.sensorIndex.size;
  }
}
