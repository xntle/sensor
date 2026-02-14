"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import mqtt from "mqtt";

/** Shape the VPS processor publishes to irrigation/processed/<id> */
export interface ProcessedMessage {
  sensor_id: string;
  ts: number;
  raw: number;
  median: number;
  filtered: number;
  status: string;        // DRY | OK | OVERWATER
  health: string[];      // ["OK"] or ["NOISY","SPIKY",…]
  noise_score: number;   // 0‒1
}

interface UseMQTTOptions {
  /** WebSocket URL of the Mosquitto broker, e.g. ws://158.69.206.50:9001 */
  brokerUrl: string;
  /** MQTT topic pattern to subscribe to */
  topic?: string;
}

export type MessageHandler = (msg: ProcessedMessage) => void;

/**
 * React hook that maintains a single MQTT-over-WebSocket connection
 * and invokes `onMessage` for every processed sensor packet.
 */
export function useMQTT({ brokerUrl, topic = "irrigation/processed/#" }: UseMQTTOptions) {
  const clientRef = useRef<mqtt.MqttClient | null>(null);
  const handlersRef = useRef<Set<MessageHandler>>(new Set());
  const [connected, setConnected] = useState(false);

  // Subscribe a handler — returns an unsubscribe function
  const subscribe = useCallback((handler: MessageHandler) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  useEffect(() => {
    const client = mqtt.connect(brokerUrl, {
      clientId: `frontend-${Math.random().toString(36).slice(2, 8)}`,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      console.log("[mqtt] connected to", brokerUrl);
      setConnected(true);
      client.subscribe(topic, { qos: 0 });
    });

    client.on("close", () => setConnected(false));
    client.on("error", (err) => console.error("[mqtt] error", err));

    client.on("message", (_topic, payload) => {
      try {
        const msg: ProcessedMessage = JSON.parse(payload.toString());
        handlersRef.current.forEach((h) => h(msg));
      } catch {
        // ignore malformed messages
      }
    });

    clientRef.current = client;

    return () => {
      client.end(true);
      clientRef.current = null;
      setConnected(false);
    };
  }, [brokerUrl, topic]);

  return { connected, subscribe };
}
