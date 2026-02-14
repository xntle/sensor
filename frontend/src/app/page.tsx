"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MapView from "@/components/Map";
import type { EditMode } from "@/components/Map";
import TopControls from "@/components/TopControls";
import Legend from "@/components/Legend";
import BlockPanel from "@/components/BlockPanel";
import ChatBot from "@/components/ChatBot";
import SensorControls from "@/components/SensorControls";
import type { LayerMode, TimeRange, Block, Sensor, Reading } from "@/types";
import { blocks as mockBlocks, sensors as mockSensors, readings as mockReadings } from "@/data/mock";
import { useMQTT } from "@/hooks/useMQTT";
import { LiveStore } from "@/data/live";

const BROKER_URL = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || "ws://158.69.206.50:9001";

export default function Home() {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [layerMode, setLayerMode] = useState<LayerMode>("decision");
  const [timeRange, setTimeRange] = useState<TimeRange>("now");
  const [editMode, setEditMode] = useState<EditMode>("none");

  // Live data state
  const [blocks, setBlocks] = useState<Block[]>(mockBlocks);
  const [sensors, setSensors] = useState<Sensor[]>(mockSensors);
  const [readings, setReadings] = useState<Reading[]>(mockReadings);
  const [isLive, setIsLive] = useState(false);

  const storeRef = useRef(new LiveStore());
  const { connected, subscribe, publish } = useMQTT({ brokerUrl: BROKER_URL });

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

  // Refresh UI from store (after position changes)
  const refreshFromStore = useCallback(() => {
    const store = storeRef.current;
    if (store.sensorCount > 0) {
      setBlocks(store.getBlocks());
      setSensors(store.getSensors());
      setReadings(store.getReadings());
    }
  }, []);

  // Handle sensor drag-move
  const handleSensorMove = useCallback((sensorId: string, lat: number, lng: number) => {
    storeRef.current.setSensorPosition(sensorId, lat, lng);
    refreshFromStore();
  }, [refreshFromStore]);

  // Handle click-to-add: creates an entirely new sensor via MQTT command
  const nextSensorIdRef = useRef(10); // start after zone00–zone09
  const handleSensorAdd = useCallback((lat: number, lng: number) => {
    // Advance past any IDs that already exist in the store
    const store = storeRef.current;
    while (store.hasSensor(`zone${String(nextSensorIdRef.current).padStart(2, "0")}`)) {
      nextSensorIdRef.current += 1;
    }

    const sensorId = `zone${String(nextSensorIdRef.current).padStart(2, "0")}`;
    nextSensorIdRef.current += 1;

    // 1. Tell sensor_sim to spawn a new virtual sensor
    publish("irrigation/command/create", {
      sensor_id: sensorId,
      baseline: Math.round(350 + Math.random() * 300), // random baseline 350–650
    });

    // 2. Pre-place it on the map at the clicked position
    storeRef.current.setSensorPosition(sensorId, lat, lng);
    refreshFromStore();

    setEditMode("none");
    console.log(`[frontend] Created sensor ${sensorId} at (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  }, [publish, refreshFromStore]);

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
        editMode={editMode}
        onSensorMove={handleSensorMove}
        onSensorAdd={handleSensorAdd}
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

      <SensorControls
        editMode={editMode}
        onEditModeChange={setEditMode}
        sensorCount={sensors.length}
      />

      <ChatBot />
    </div>
  );
}
