"use client";

import { MapPin, Move, Plus, X } from "lucide-react";
import type { EditMode } from "@/components/Map";

interface SensorControlsProps {
  editMode: EditMode;
  onEditModeChange: (mode: EditMode) => void;
  sensorCount: number;
}

export default function SensorControls({
  editMode,
  onEditModeChange,
  sensorCount,
}: SensorControlsProps) {
  return (
    <div className="absolute bottom-6 right-4 z-10 flex flex-col gap-2">
      {/* Edit mode buttons */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-white/90 p-2 shadow-lg backdrop-blur">
        <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <MapPin size={11} />
          Sensors ({sensorCount})
        </div>

        <button
          onClick={() =>
            onEditModeChange(editMode === "drag" ? "none" : "drag")
          }
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            editMode === "drag"
              ? "bg-violet-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Move size={13} />
          {editMode === "drag" ? "Done Moving" : "Move Sensors"}
        </button>

        <button
          onClick={() =>
            onEditModeChange(editMode === "add" ? "none" : "add")
          }
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            editMode === "add"
              ? "bg-emerald-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <Plus size={13} />
          {editMode === "add" ? "Done Adding" : "Add Sensor"}
        </button>
      </div>

      {/* Mode hint */}
      {editMode !== "none" && (
        <div className="rounded-lg bg-gray-900/80 px-3 py-2 text-center shadow-lg backdrop-blur">
          <p className="text-xs font-medium text-white">
            {editMode === "drag"
              ? "Click & drag a sensor to move it"
              : "Click the map to place a sensor"}
          </p>
          <button
            onClick={() => onEditModeChange("none")}
            className="mt-1 flex items-center gap-1 mx-auto text-[10px] text-gray-400 hover:text-white"
          >
            <X size={10} />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
