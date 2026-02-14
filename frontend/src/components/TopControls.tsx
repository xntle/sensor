"use client";

import {
  Clock,
  Layers,
  Droplets,
  ShieldCheck,
  Activity,
  Target,
} from "lucide-react";
import type { LayerMode, TimeRange } from "@/types";
import type { ReactNode } from "react";

const timeOptions: { value: TimeRange; label: string }[] = [
  { value: "now", label: "Now" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
];

const layerOptions: { value: LayerMode; label: string; icon: ReactNode }[] = [
  { value: "decision", label: "Decision", icon: <Target size={13} /> },
  { value: "moisture", label: "Moisture", icon: <Droplets size={13} /> },
  { value: "confidence", label: "Confidence", icon: <ShieldCheck size={13} /> },
  { value: "health", label: "Health", icon: <Activity size={13} /> },
];

interface TopControlsProps {
  timeRange: TimeRange;
  layerMode: LayerMode;
  onTimeChange: (t: TimeRange) => void;
  onLayerChange: (l: LayerMode) => void;
}

export default function TopControls({
  timeRange,
  layerMode,
  onTimeChange,
  onLayerChange,
}: TopControlsProps) {
  return (
    <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 gap-3">
      {/* Time range */}
      <div className="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur">
        <Clock size={14} className="mr-1 text-gray-400" />
        {timeOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => onTimeChange(o.value)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              timeRange === o.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Layer mode */}
      <div className="flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur">
        <Layers size={14} className="mr-1 text-gray-400" />
        {layerOptions.map((o) => (
          <button
            key={o.value}
            onClick={() => onLayerChange(o.value)}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              layerMode === o.value
                ? "bg-gray-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
