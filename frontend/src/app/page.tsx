"use client";

import { useState } from "react";
import MapView from "@/components/Map";
import TopControls from "@/components/TopControls";
import Legend from "@/components/Legend";
import BlockPanel from "@/components/BlockPanel";
import type { LayerMode, TimeRange, Block } from "@/types";
import { blocks, sensors, readings } from "@/data/mock";

export default function Home() {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [layerMode, setLayerMode] = useState<LayerMode>("decision");
  const [timeRange, setTimeRange] = useState<TimeRange>("now");

  const selectedBlock: Block | undefined = blocks.find(
    (b) => b.id === selectedBlockId
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView
        layerMode={layerMode}
        selectedBlockId={selectedBlockId}
        onBlockSelect={setSelectedBlockId}
      />

      <TopControls
        timeRange={timeRange}
        layerMode={layerMode}
        onTimeChange={setTimeRange}
        onLayerChange={setLayerMode}
      />

      <Legend layerMode={layerMode} />

      {selectedBlock && (
        <BlockPanel
          block={selectedBlock}
          sensors={sensors}
          readings={readings}
          onClose={() => setSelectedBlockId(null)}
        />
      )}
    </div>
  );
}
