import type { Block, Sensor, Reading } from "@/types";

// 6686 Sievers Rd, Dixon, CA 95620 — center ≈ 38.4855, -121.8165
// Blocks placed on green crop fields south of Sievers Rd
export const blocks: Block[] = [
  {
    id: "block-1",
    name: "North Field",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.8220, 38.4880],
          [-121.8170, 38.4880],
          [-121.8170, 38.4865],
          [-121.8220, 38.4865],
          [-121.8220, 38.4880],
        ],
      ],
    },
    soil_type: "silt_loam",
    moisture_now: 0.32,
    moisture_raw: 0.35,
    confidence: 0.92,
    decision: "IRRIGATE",
    reason:
      "Soil moisture below threshold (32%). Last irrigation 48h ago. ET demand high. Hot dry week ahead with no rain forecast.",
    risk_flags: [],
    last_updated: new Date(Date.now() - 10 * 60_000).toISOString(),
    weather: {
      temperature: 94,
      humidity: 28,
      wind_speed: 12,
      solar_radiation: 850,
      rain_forecast_24h: 0,
      rain_last_24h: 0,
    },
    crop: {
      crop: "Tomatoes",
      stage: "flowering",
      days_in_stage: 8,
      water_sensitivity: "critical",
    },
    irrigation: {
      last_irrigation: new Date(Date.now() - 48 * 3600_000).toISOString(),
      hours_since: 48,
      amount_gallons: 12000,
      method: "drip",
      pump_runtime_min: 180,
    },
    et: {
      et_today: 0.28,
      et_7day_avg: 0.31,
      water_balance: -0.55,
    },
  },
  {
    id: "block-2",
    name: "Northeast Block",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.8168, 38.4880],
          [-121.8115, 38.4880],
          [-121.8115, 38.4865],
          [-121.8168, 38.4865],
          [-121.8168, 38.4880],
        ],
      ],
    },
    soil_type: "clay_loam",
    moisture_now: 0.58,
    moisture_raw: 0.6,
    confidence: 0.87,
    decision: "WAIT",
    reason:
      "Moisture adequate (58%). Rain forecast 0.4in in next 24h. Clay loam retains well. Crop in vegetative stage — moderate water needs.",
    risk_flags: [],
    last_updated: new Date(Date.now() - 5 * 60_000).toISOString(),
    weather: {
      temperature: 82,
      humidity: 45,
      wind_speed: 6,
      solar_radiation: 720,
      rain_forecast_24h: 0.4,
      rain_last_24h: 0.15,
    },
    crop: {
      crop: "Lettuce",
      stage: "vegetative",
      days_in_stage: 14,
      water_sensitivity: "moderate",
    },
    irrigation: {
      last_irrigation: new Date(Date.now() - 18 * 3600_000).toISOString(),
      hours_since: 18,
      amount_gallons: 8000,
      method: "drip",
      pump_runtime_min: 120,
    },
    et: {
      et_today: 0.18,
      et_7day_avg: 0.22,
      water_balance: 0.12,
    },
  },
  {
    id: "block-3",
    name: "West Block",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.8220, 38.4863],
          [-121.8170, 38.4863],
          [-121.8170, 38.4847],
          [-121.8220, 38.4847],
          [-121.8220, 38.4863],
        ],
      ],
    },
    soil_type: "sandy_loam",
    moisture_now: 0.28,
    moisture_raw: 0.41,
    confidence: 0.45,
    decision: "IRRIGATE",
    reason:
      "Moisture low (28%) but confidence reduced — sensor reading jumped from 41% to 28% in 2h. Sandy loam drains fast but jump is suspicious. Verify sensor before irrigating.",
    risk_flags: ["anomaly_detected", "needs_check"],
    last_updated: new Date(Date.now() - 25 * 60_000).toISOString(),
    weather: {
      temperature: 91,
      humidity: 32,
      wind_speed: 15,
      solar_radiation: 880,
      rain_forecast_24h: 0,
      rain_last_24h: 0,
    },
    crop: {
      crop: "Peppers",
      stage: "fruit_set",
      days_in_stage: 5,
      water_sensitivity: "high",
    },
    irrigation: {
      last_irrigation: new Date(Date.now() - 30 * 3600_000).toISOString(),
      hours_since: 30,
      amount_gallons: 10000,
      method: "drip",
      pump_runtime_min: 150,
    },
    et: {
      et_today: 0.30,
      et_7day_avg: 0.29,
      water_balance: -0.42,
    },
  },
  {
    id: "block-4",
    name: "East Block",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.8168, 38.4863],
          [-121.8115, 38.4863],
          [-121.8115, 38.4847],
          [-121.8168, 38.4847],
          [-121.8168, 38.4863],
        ],
      ],
    },
    soil_type: "loam",
    moisture_now: 0.52,
    moisture_raw: 0.52,
    confidence: 0.78,
    decision: "WAIT",
    reason:
      "Moisture within range (52%). Loam holding steady. Crop in maturation — reduced water needs. Sensor calibration due in 3 days, readings may drift.",
    risk_flags: ["calibration_due"],
    last_updated: new Date(Date.now() - 15 * 60_000).toISOString(),
    weather: {
      temperature: 86,
      humidity: 40,
      wind_speed: 8,
      solar_radiation: 780,
      rain_forecast_24h: 0.1,
      rain_last_24h: 0,
    },
    crop: {
      crop: "Squash",
      stage: "maturation",
      days_in_stage: 12,
      water_sensitivity: "low",
    },
    irrigation: {
      last_irrigation: new Date(Date.now() - 24 * 3600_000).toISOString(),
      hours_since: 24,
      amount_gallons: 6000,
      method: "sprinkler",
      pump_runtime_min: 90,
    },
    et: {
      et_today: 0.22,
      et_7day_avg: 0.24,
      water_balance: -0.08,
    },
  },
  {
    id: "block-5",
    name: "South Field",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-121.8220, 38.4845],
          [-121.8115, 38.4845],
          [-121.8115, 38.4828],
          [-121.8220, 38.4828],
          [-121.8220, 38.4845],
        ],
      ],
    },
    soil_type: "clay_loam",
    moisture_now: 0.39,
    moisture_raw: 0.39,
    confidence: 0.3,
    decision: "IRRIGATE",
    reason:
      "Sensor offline since 2h ago — moisture estimated from weather model + last known reading. Clay loam buffers well but ET is high. Manual soil check recommended before irrigating.",
    risk_flags: ["sensor_offline"],
    last_updated: new Date(Date.now() - 120 * 60_000).toISOString(),
    weather: {
      temperature: 92,
      humidity: 30,
      wind_speed: 14,
      solar_radiation: 860,
      rain_forecast_24h: 0,
      rain_last_24h: 0,
    },
    crop: {
      crop: "Corn",
      stage: "vegetative",
      days_in_stage: 21,
      water_sensitivity: "moderate",
    },
    irrigation: {
      last_irrigation: new Date(Date.now() - 60 * 3600_000).toISOString(),
      hours_since: 60,
      amount_gallons: 15000,
      method: "flood",
      pump_runtime_min: 240,
    },
    et: {
      et_today: 0.26,
      et_7day_avg: 0.28,
      water_balance: -0.72,
    },
  },
];

export const sensors: Sensor[] = [
  {
    sensor_id: "S001",
    type: "soil",
    lat: 38.4873,
    lng: -121.8195,
    block_id: "block-1",
    status: "online",
  },
  {
    sensor_id: "S002",
    type: "soil",
    lat: 38.4873,
    lng: -121.8145,
    block_id: "block-2",
    status: "online",
  },
  {
    sensor_id: "S003",
    type: "weather",
    lat: 38.4877,
    lng: -121.8130,
    block_id: "block-2",
    status: "online",
  },
  {
    sensor_id: "S004",
    type: "soil",
    lat: 38.4855,
    lng: -121.8195,
    block_id: "block-3",
    status: "online",
  },
  {
    sensor_id: "S005",
    type: "soil",
    lat: 38.4855,
    lng: -121.8145,
    block_id: "block-4",
    status: "online",
  },
  {
    sensor_id: "S006",
    type: "weather",
    lat: 38.4858,
    lng: -121.8125,
    block_id: "block-4",
    status: "online",
  },
  {
    sensor_id: "S007",
    type: "soil",
    lat: 38.4837,
    lng: -121.8185,
    block_id: "block-5",
    status: "offline",
  },
  {
    sensor_id: "S008",
    type: "weather",
    lat: 38.4837,
    lng: -121.8145,
    block_id: "block-5",
    status: "offline",
  },
];

export const readings: Reading[] = [
  {
    sensor_id: "S001",
    timestamp: new Date(Date.now() - 10 * 60_000).toISOString(),
    moisture_raw: 0.35,
    moisture_corrected: 0.32,
    temperature: 22.1,
    humidity: 55,
  },
  {
    sensor_id: "S002",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    moisture_raw: 0.6,
    moisture_corrected: 0.58,
    temperature: 21.8,
    humidity: 62,
  },
  {
    sensor_id: "S003",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    moisture_raw: 0.0,
    moisture_corrected: 0.0,
    temperature: 22.3,
    humidity: 60,
  },
  {
    sensor_id: "S004",
    timestamp: new Date(Date.now() - 25 * 60_000).toISOString(),
    moisture_raw: 0.41,
    moisture_corrected: 0.28,
    temperature: 23.0,
    humidity: 50,
  },
  {
    sensor_id: "S005",
    timestamp: new Date(Date.now() - 15 * 60_000).toISOString(),
    moisture_raw: 0.52,
    moisture_corrected: 0.52,
    temperature: 22.5,
    humidity: 57,
  },
  {
    sensor_id: "S006",
    timestamp: new Date(Date.now() - 15 * 60_000).toISOString(),
    moisture_raw: 0.0,
    moisture_corrected: 0.0,
    temperature: 22.0,
    humidity: 58,
  },
];

// GeoJSON FeatureCollection for Mapbox
export function blocksToGeoJSON(
  blockList: Block[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: blockList.map((b) => ({
      type: "Feature" as const,
      id: b.id,
      properties: {
        id: b.id,
        name: b.name,
        moisture_now: b.moisture_now,
        confidence: b.confidence,
        decision: b.decision,
        risk_flags: b.risk_flags.join(","),
        last_updated: b.last_updated,
      },
      geometry: b.geometry,
    })),
  };
}

export function sensorsToGeoJSON(
  sensorList: Sensor[]
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sensorList.map((s) => ({
      type: "Feature" as const,
      id: s.sensor_id,
      properties: {
        sensor_id: s.sensor_id,
        type: s.type,
        block_id: s.block_id,
        status: s.status,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [s.lng, s.lat],
      },
    })),
  };
}
