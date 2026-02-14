export type Decision = "IRRIGATE" | "WAIT";

export type RiskFlag =
  | "sensor_offline"
  | "sensor_suspect"
  | "needs_check"
  | "anomaly_detected"
  | "calibration_due";

export type SensorType = "soil" | "weather";
export type SensorStatus = "online" | "offline";

export type LayerMode = "decision" | "moisture" | "confidence" | "health";
export type TimeRange = "now" | "6h" | "24h";

export type CropStage =
  | "germination"
  | "vegetative"
  | "flowering"
  | "fruit_set"
  | "maturation"
  | "harvest_ready";

export type SoilType = "sandy_loam" | "clay_loam" | "silt_loam" | "loam" | "clay" | "sand";

export interface WeatherConditions {
  temperature: number;       // °F
  humidity: number;          // %
  wind_speed: number;        // mph
  solar_radiation: number;   // W/m²
  rain_forecast_24h: number; // inches expected
  rain_last_24h: number;     // inches received
}

export interface CropInfo {
  crop: string;
  stage: CropStage;
  days_in_stage: number;
  water_sensitivity: "low" | "moderate" | "high" | "critical";
}

export interface IrrigationHistory {
  last_irrigation: string;   // ISO timestamp
  hours_since: number;
  amount_gallons: number;
  method: "drip" | "sprinkler" | "flood" | "pivot";
  pump_runtime_min: number;
}

export interface ETData {
  et_today: number;          // inches of water lost today
  et_7day_avg: number;       // inches/day average over last week
  water_balance: number;     // ET - (rain + irrigation), negative = deficit
}

export interface Block {
  id: string;
  name: string;
  geometry: GeoJSON.Polygon;
  soil_type: SoilType;
  moisture_now: number;
  moisture_raw: number;
  confidence: number;
  decision: Decision;
  reason: string;
  risk_flags: RiskFlag[];
  last_updated: string;
  weather: WeatherConditions;
  crop: CropInfo;
  irrigation: IrrigationHistory;
  et: ETData;
}

export interface Sensor {
  sensor_id: string;
  type: SensorType;
  lat: number;
  lng: number;
  block_id: string;
  status: SensorStatus;
}

export interface Reading {
  sensor_id: string;
  timestamp: string;
  moisture_raw: number;
  moisture_corrected: number;
  temperature: number;
  humidity: number;
}

export interface Action {
  block_id: string;
  decision: Decision;
  confidence: number;
  reason: string;
}
