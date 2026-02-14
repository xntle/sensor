"use client";

import { useState, useEffect, useRef } from "react";
import MapView from "@/components/Map";
import TopControls from "@/components/TopControls";
import Legend from "@/components/Legend";
import BlockPanel from "@/components/BlockPanel";
import type { LayerMode, TimeRange, Block, Sensor, Reading } from "@/types";
import { blocks as mockBlocks, sensors as mockSensors, readings as mockReadings } from "@/data/mock";
import { useMQTT } from "@/hooks/useMQTT";
import { LiveStore } from "@/data/live";

const BROKER_URL = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://158.69.206.50:9001";

export default function Home() {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [layerMode, setLayerMode] = useState<LayerMode>("decision");
  const [timeRange, setTimeRange] = useState<TimeRange>("now");

  // Live data state
  const [blocks, setBlocks] = useState<Block[]>(mockBlocks);
  const [sensors, setSensors] = useState<Sensor[]>(mockSensors);
  const [readings, setReadings] = useState<Reading[]>(mockReadings);
  const [isLive, setIsLive] = useState(false);

  const storeRef = useRef(new LiveStore());
  const { connected, subscribe } = useMQTT({ brokerUrl: BROKER_URL });

  // When MQTT messages arrive, ingest and update state
  useEffect(() => {
    const unsub = subscribe((msg) => {
      const store = storeRef.current;
      store.ingest(msg);

      // Once we have at least 1 sensor, switch to live data
      if (store.sensorCount > 0) {
        setBlocks(store.getBlocks());
        setSensors(store.getSensors());
        setReadings(store.getReadings());
        if (!isLive) setIsLive(true);
      }
    });
    return unsub;
  }, [subscribe, isLive]);

  const selectedBlock: Block | undefined = blocks.find(
    (b) => b.id === selectedBlockId
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView
        blocks={blocks}
        sensors={sensors}
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

      {/* Connection indicator */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            connected ? "bg-green-400 animate-pulse" : "bg-red-400"
          }`}
        />
        <span className="text-xs font-medium text-gray-600">
          {connected ? (isLive ? "Live" : "Connected") : "Offline"}
        </span>
        {isLive && (
          <span className="text-[10px] text-gray-400">
            {storeRef.current.sensorCount} sensors
          </span>
        )}
      </div>

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
