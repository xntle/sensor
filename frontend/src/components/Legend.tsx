"use client";

import { Droplets, Target, ShieldCheck, Activity } from "lucide-react";
import type { LayerMode } from "@/types";
import type { ReactNode } from "react";

interface LegendProps {
  layerMode: LayerMode;
}

const legends: Record<
  LayerMode,
  { icon: ReactNode; colors: string[]; labels: string[] }
> = {
  decision: {
    icon: <Target size={13} />,
    colors: ["#ef4444", "#22c55e"],
    labels: ["Irrigate", "Wait"],
  },
  moisture: {
    icon: <Droplets size={13} />,
    colors: ["#3b82f6", "#60a5fa", "#fbbf24", "#ef4444"],
    labels: ["High", "", "", "Low"],
  },
  confidence: {
    icon: <ShieldCheck size={13} />,
    colors: ["#1e3a5f", "#93c5fd"],
    labels: ["High", "Low"],
  },
  health: {
    icon: <Activity size={13} />,
    colors: ["#22c55e", "#eab308", "#ef4444"],
    labels: ["OK", "Warning", "Critical"],
  },
};

export default function Legend({ layerMode }: LegendProps) {
  const { icon, colors, labels } = legends[layerMode];

  return (
    <div className="absolute bottom-6 left-4 z-10 rounded-lg bg-white/90 px-3 py-2 shadow-lg backdrop-blur">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold capitalize text-gray-700">
        {icon}
        {layerMode}
      </div>
      <div className="flex items-center gap-0">
        {colors.map((c, i) => (
          <div key={i} className="flex flex-col items-center">
            <div
              className="h-3 w-8"
              style={{
                backgroundColor: c,
                borderRadius:
                  i === 0
                    ? "4px 0 0 4px"
                    : i === colors.length - 1
                      ? "0 4px 4px 0"
                      : "0",
              }}
            />
            {labels[i] && (
              <span className="mt-0.5 text-[10px] text-gray-500">
                {labels[i]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 bg-gray-800" /> High conf.
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-gray-800" />{" "}
          Low conf.
        </span>
      </div>
    </div>
  );
}
