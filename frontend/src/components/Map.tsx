"use client";

import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { LayerMode, Block, Sensor } from "@/types";
import {
  blocksToGeoJSON,
  sensorsToGeoJSON,
} from "@/data/mock";

interface MapProps {
  blocks: Block[];
  sensors: Sensor[];
  layerMode: LayerMode;
  onBlockSelect: (blockId: string | null) => void;
  selectedBlockId: string | null;
}

// Paint expressions for each layer mode
function getFillColor(mode: LayerMode): mapboxgl.Expression {
  switch (mode) {
    case "decision":
      return [
        "case",
        ["==", ["get", "decision"], "IRRIGATE"],
        "#ef4444",
        "#22c55e",
      ];
    case "moisture":
      return [
        "interpolate",
        ["linear"],
        ["get", "moisture_now"],
        0.2,
        "#ef4444",
        0.35,
        "#fbbf24",
        0.5,
        "#60a5fa",
        0.7,
        "#3b82f6",
      ];
    case "confidence":
      return [
        "interpolate",
        ["linear"],
        ["get", "confidence"],
        0.0,
        "#93c5fd",
        1.0,
        "#1e3a5f",
      ];
    case "health":
      return [
        "case",
        ["==", ["get", "risk_flags"], ""],
        "#22c55e",
        [
          "any",
          ["in", "sensor_offline", ["get", "risk_flags"]],
          ["in", "sensor_suspect", ["get", "risk_flags"]],
        ],
        "#ef4444",
        "#eab308",
      ];
  }
}

function getFillOpacity(mode: LayerMode): mapboxgl.Expression | number {
  if (mode === "confidence") {
    return ["interpolate", ["linear"], ["get", "confidence"], 0, 0.2, 1, 0.6];
  }
  return 0.55;
}

export default function MapView({
  blocks,
  sensors,
  layerMode,
  onBlockSelect,
  selectedBlockId,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onBlockSelectRef = useRef(onBlockSelect);
  onBlockSelectRef.current = onBlockSelect;

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set");
      return;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [-121.8168, 38.4855],
      zoom: 15,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      // Block polygons source
      map.addSource("blocks", {
        type: "geojson",
        data: blocksToGeoJSON(blocks),
      });

      // Fill layer
      map.addLayer({
        id: "blocks-fill",
        type: "fill",
        source: "blocks",
        paint: {
          "fill-color": getFillColor("decision") as unknown as string,
          "fill-opacity": 0.55,
        },
      });

      // Outline — solid for high confidence, dashed for low
      map.addLayer({
        id: "blocks-outline-solid",
        type: "line",
        source: "blocks",
        filter: [">=", ["get", "confidence"], 0.6],
        paint: {
          "line-color": "#ffffff",
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "blocks-outline-dashed",
        type: "line",
        source: "blocks",
        filter: ["<", ["get", "confidence"], 0.6],
        paint: {
          "line-color": "#ffffff",
          "line-width": 2,
          "line-opacity": 0.7,
          "line-dasharray": [3, 2],
        },
      });

      // Selected block highlight
      map.addLayer({
        id: "blocks-selected",
        type: "line",
        source: "blocks",
        filter: ["==", ["get", "id"], ""],
        paint: {
          "line-color": "#fbbf24",
          "line-width": 4,
          "line-opacity": 1,
        },
      });

      // Sensor points source
      map.addSource("sensors", {
        type: "geojson",
        data: sensorsToGeoJSON(sensors),
      });

      // Sensor circles
      map.addLayer({
        id: "sensors-circle",
        type: "circle",
        source: "sensors",
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "case",
            ["==", ["get", "status"], "offline"],
            "#ef4444",
            [
              "case",
              ["==", ["get", "type"], "soil"],
              "#8b5cf6",
              "#0ea5e9",
            ],
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // Sensor labels
      map.addLayer({
        id: "sensors-label",
        type: "symbol",
        source: "sensors",
        layout: {
          "text-field": ["get", "sensor_id"],
          "text-size": 10,
          "text-offset": [0, 1.5],
          "text-anchor": "top",
          "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
        },
      });

      // Click handler for blocks
      map.on("click", "blocks-fill", (e) => {
        if (e.features && e.features.length > 0) {
          const id = e.features[0].properties?.id ?? null;
          onBlockSelectRef.current(id);
        }
      });

      // Cursor changes
      map.on("mouseenter", "blocks-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "blocks-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Click outside blocks to deselect
      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["blocks-fill"],
        });
        if (features.length === 0) {
          onBlockSelectRef.current(null);
        }
      });
    });

    mapRef.current = map;
  }, []);

  // Initialize map
  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  // Update layer mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      map.setPaintProperty(
        "blocks-fill",
        "fill-color",
        getFillColor(layerMode)
      );
      map.setPaintProperty(
        "blocks-fill",
        "fill-opacity",
        getFillOpacity(layerMode)
      );
    } catch {
      // Layer may not be ready yet
    }
  }, [layerMode]);

  // Update GeoJSON sources when blocks/sensors change (live data)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    try {
      const blocksSrc = map.getSource("blocks") as mapboxgl.GeoJSONSource | undefined;
      if (blocksSrc) blocksSrc.setData(blocksToGeoJSON(blocks));
      const sensorsSrc = map.getSource("sensors") as mapboxgl.GeoJSONSource | undefined;
      if (sensorsSrc) sensorsSrc.setData(sensorsToGeoJSON(sensors));
    } catch {
      // Sources may not be ready yet
    }
  }, [blocks, sensors]);

  // Update selected block highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      map.setFilter("blocks-selected", [
        "==",
        ["get", "id"],
        selectedBlockId ?? "",
      ]);
    } catch {
      // Layer may not be ready yet
    }
  }, [selectedBlockId]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="flex h-full items-center justify-center bg-gray-900 text-white">
          <div className="text-center">
            <p className="mb-2 text-lg font-semibold">Mapbox token missing</p>
            <p className="text-sm text-gray-400">
              Set <code className="rounded bg-gray-700 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
              <code className="rounded bg-gray-700 px-1">.env.local</code>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
