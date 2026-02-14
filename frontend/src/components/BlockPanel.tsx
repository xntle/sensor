"use client";

import {
  X,
  Droplets,
  CloudSun,
  Thermometer,
  Wind,
  Sun,
  CloudRain,
  Sprout,
  Clock,
  Gauge,
  Waves,
  AlertTriangle,
  Radio,
  Calendar,
  Play,
  Droplet,
} from "lucide-react";
import type { Block, Sensor, Reading, CropStage } from "@/types";

interface BlockPanelProps {
  block: Block;
  sensors: Sensor[];
  readings: Reading[];
  onClose: () => void;
}

function riskLabel(flag: string): string {
  const map: Record<string, string> = {
    sensor_offline: "Sensor Offline",
    sensor_suspect: "Sensor Suspect",
    needs_check: "Needs Check",
    anomaly_detected: "Anomaly Detected",
    calibration_due: "Calibration Due",
  };
  return map[flag] ?? flag;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h ago`;
}

function stageLabel(stage: CropStage): string {
  const map: Record<CropStage, string> = {
    germination: "Germination",
    vegetative: "Vegetative",
    flowering: "Flowering",
    fruit_set: "Fruit Set",
    maturation: "Maturation",
    harvest_ready: "Harvest Ready",
  };
  return map[stage];
}

function soilLabel(soil: string): string {
  return soil.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function sensitivityColor(level: string): string {
  switch (level) {
    case "critical":
      return "bg-red-100 text-red-700";
    case "high":
      return "bg-orange-100 text-orange-700";
    case "moderate":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-green-100 text-green-700";
  }
}

function StatRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-gray-900">{value}</span>
        {sub && <span className="ml-1 text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

export default function BlockPanel({
  block,
  sensors,
  readings,
  onClose,
}: BlockPanelProps) {
  const blockSensors = sensors.filter((s) => s.block_id === block.id);
  const blockReadings = readings.filter((r) =>
    blockSensors.some((s) => s.sensor_id === r.sensor_id)
  );

  const { weather, crop, irrigation, et } = block;

  return (
    <div className="absolute right-0 top-0 z-20 flex h-full w-[420px] flex-col bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{block.name}</h2>
          <p className="text-xs text-gray-500">
            {soilLabel(block.soil_type)} &middot; Updated{" "}
            {timeAgo(block.last_updated)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Decision + confidence */}
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${
              block.decision === "IRRIGATE"
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {block.decision}
          </span>
          <div className="flex-1">
            <div className="mb-0.5 flex justify-between text-xs text-gray-500">
              <span>Confidence</span>
              <span>{Math.round(block.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full ${
                  block.confidence > 0.7
                    ? "bg-green-500"
                    : block.confidence > 0.4
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${block.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-sm leading-relaxed text-gray-600">{block.reason}</p>

        {/* Risk flags */}
        {block.risk_flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {block.risk_flags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200"
              >
                <AlertTriangle size={10} />
                {riskLabel(flag)}
              </span>
            ))}
          </div>
        )}

        {/* ── DECISION INPUTS ── */}
        <div className="border-t pt-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Decision Inputs
          </h3>

          {/* Soil Moisture */}
          <div className="mb-3 rounded-lg bg-gray-50 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Droplets size={13} className="text-blue-500" />
              Soil Moisture
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(block.moisture_now * 100)}%
                </div>
                <div className="text-[10px] text-gray-500">Corrected</div>
              </div>
              <div>
                <div className="text-xl font-bold text-gray-400">
                  {Math.round(block.moisture_raw * 100)}%
                </div>
                <div className="text-[10px] text-gray-500">Raw sensor</div>
              </div>
            </div>
          </div>

          {/* Weather */}
          <div className="mb-3 rounded-lg bg-blue-50/60 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <CloudSun size={13} className="text-sky-500" />
              Weather
            </div>
            <div className="grid grid-cols-2 gap-x-4 divide-y divide-blue-100">
              <StatRow label="Temp" value={`${weather.temperature}°F`} />
              <StatRow label="Humidity" value={`${weather.humidity}%`} />
              <StatRow label="Wind" value={`${weather.wind_speed} mph`} />
              <StatRow
                label="Solar"
                value={`${weather.solar_radiation}`}
                sub="W/m²"
              />
              <StatRow
                label="Rain (24h forecast)"
                value={
                  weather.rain_forecast_24h > 0
                    ? `${weather.rain_forecast_24h} in`
                    : "None"
                }
              />
              <StatRow
                label="Rain (last 24h)"
                value={
                  weather.rain_last_24h > 0
                    ? `${weather.rain_last_24h} in`
                    : "None"
                }
              />
            </div>
          </div>

          {/* Crop Stage */}
          <div className="mb-3 rounded-lg bg-emerald-50/60 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Sprout size={13} className="text-emerald-500" />
              Crop
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {crop.crop}
                </span>
                <span className="mx-1.5 text-gray-300">&middot;</span>
                <span className="text-sm text-gray-600">
                  {stageLabel(crop.stage)}
                </span>
                <span className="ml-1 text-xs text-gray-400">
                  (day {crop.days_in_stage})
                </span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sensitivityColor(crop.water_sensitivity)}`}
              >
                {crop.water_sensitivity}
              </span>
            </div>
          </div>

          {/* Irrigation History */}
          <div className="mb-3 rounded-lg bg-violet-50/60 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Droplet size={13} className="text-violet-500" />
              Last Irrigation
            </div>
            <div className="grid grid-cols-2 gap-x-4 divide-y divide-violet-100">
              <StatRow
                label="When"
                value={`${irrigation.hours_since}h ago`}
              />
              <StatRow
                label="Method"
                value={
                  irrigation.method.charAt(0).toUpperCase() +
                  irrigation.method.slice(1)
                }
              />
              <StatRow
                label="Amount"
                value={irrigation.amount_gallons.toLocaleString()}
                sub="gal"
              />
              <StatRow
                label="Pump runtime"
                value={`${irrigation.pump_runtime_min}`}
                sub="min"
              />
            </div>
          </div>

          {/* Evapotranspiration */}
          <div className="mb-3 rounded-lg bg-orange-50/60 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Waves size={13} className="text-orange-500" />
              Evapotranspiration (ET)
            </div>
            <div className="grid grid-cols-2 gap-x-4 divide-y divide-orange-100">
              <StatRow
                label="ET today"
                value={`${et.et_today.toFixed(2)}`}
                sub="in"
              />
              <StatRow
                label="7-day avg"
                value={`${et.et_7day_avg.toFixed(2)}`}
                sub="in/day"
              />
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-orange-100 pt-2">
              <span className="text-xs text-gray-500">Water balance</span>
              <span
                className={`text-sm font-bold ${et.water_balance < 0 ? "text-red-600" : "text-green-600"}`}
              >
                {et.water_balance > 0 ? "+" : ""}
                {et.water_balance.toFixed(2)} in
              </span>
            </div>
          </div>
        </div>

        {/* Sensors */}
        <div className="border-t pt-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
            <Radio size={12} />
            Sensors ({blockSensors.length})
          </h3>
          <div className="space-y-1.5">
            {blockSensors.map((sensor) => {
              const reading = blockReadings.find(
                (r) => r.sensor_id === sensor.sensor_id
              );
              return (
                <div
                  key={sensor.sensor_id}
                  className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sensor.status === "online"
                          ? "bg-green-400"
                          : "bg-red-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {sensor.sensor_id}
                    </span>
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                      {sensor.type}
                    </span>
                  </div>
                  {reading && sensor.type === "soil" && (
                    <span className="text-sm text-gray-500">
                      {Math.round(reading.moisture_corrected * 100)}%
                    </span>
                  )}
                  {reading && sensor.type === "weather" && (
                    <span className="text-sm text-gray-500">
                      {reading.temperature}°C
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 border-t pt-3">
          <button
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              block.decision === "IRRIGATE"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
            disabled={block.decision !== "IRRIGATE"}
          >
            <Play size={14} />
            Irrigate Now
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
            <Calendar size={14} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
