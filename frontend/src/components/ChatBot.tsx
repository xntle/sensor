"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, Mic, MicOff, Send, Volume2, VolumeX, User } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function SproutImg({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/sprout.png"
      alt="Sprout"
      width={size}
      height={size}
      className="object-contain"
      priority
    />
  );
}

function MiniSprout() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#137253]/10">
      <SproutImg size={22} />
    </div>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Howdy! I'm Sprout, your field buddy. I've been keeping an eye on your soil, weather, and crops. Ask me anything — or just hit the mic and lettuce talk!",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = useCallback(
    (text: string) => {
      if (!speakEnabled || typeof window === "undefined") return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      const voices = synth.getVoices();
      const preferred =
        voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ??
        voices.find((v) => v.lang.startsWith("en-US"));
      if (preferred) utterance.voice = preferred;
      synth.speak(utterance);
    },
    [speakEnabled]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      const userMsg: Message = { role: "user", content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        const data = await res.json();
        const raw = data.reply ?? data.error ?? "Oops, my roots got tangled. Try again?";
        const reply = raw
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/\*(.*?)\*/g, "$1")
          .replace(/^#{1,6}\s+/gm, "")
          .replace(/^\d+\.\s+/gm, "")
          .replace(/^[-*]\s+/gm, "")
          .replace(/`(.*?)`/g, "$1");
        const assistantMsg: Message = { role: "assistant", content: reply };
        setMessages((prev) => [...prev, assistantMsg]);
        speak(reply);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Hmm, I can't reach the cloud (the tech kind, not the rain kind). Check your API key!",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, speak]
  );

  const toggleListening = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome.");
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, sendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 left-4 z-30 group flex items-center gap-2.5 rounded-full bg-white/90 pl-1.5 pr-4 py-1.5 shadow-lg backdrop-blur transition-all hover:shadow-xl hover:bg-white"
      >
        <SproutImg size={36} />
        <div className="text-left">
          <div className="text-sm font-bold" style={{ color: "#137253" }}>Sprout</div>
          <div className="text-[10px] text-gray-500 group-hover:text-[#137253] transition-colors">
            Tap to chat!
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-30 flex h-[540px] w-[380px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: "#137253" }}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-white/20 p-1">
            <SproutImg size={30} />
          </div>
          <div>
            <div className="text-sm font-bold">Sprout</div>
            <div className="text-[10px] text-white/70">
              Your AI field buddy
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSpeakEnabled(!speakEnabled)}
            className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
            title={speakEnabled ? "Mute voice" : "Enable voice"}
          >
            {speakEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              window.speechSynthesis?.cancel();
            }}
            className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && <MiniSprout />}
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
              style={msg.role === "user" ? { backgroundColor: "#137253" } : undefined}
            >
              {msg.content}
            </div>
            {msg.role === "user" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: "#137253" }}>
                <User size={14} />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <MiniSprout />
            <div className="rounded-2xl rounded-bl-md bg-gray-100 px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 italic">Sprout is thinking</span>
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ backgroundColor: "#137253" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ backgroundColor: "#137253" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ backgroundColor: "#137253" }} />
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && !loading && (
        <div className="border-t bg-gray-50 px-3 py-2">
          <div className="mb-1 text-[10px] font-medium text-gray-400 uppercase tracking-wider">Try asking</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Which fields need water?",
              "How's the North Field?",
              "Is rain coming?",
              "Any sensor issues?",
            ].map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs hover:bg-gray-100 transition-colors"
                style={{ color: "#137253" }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t bg-white px-3 py-3">
        {listening && (
          <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs border" style={{ backgroundColor: "#137253" + "10", color: "#137253", borderColor: "#137253" + "30" }}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: "#137253" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: "#137253" }} />
            </span>
            I'm all ears! Speak now...
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              listening
                ? "text-white shadow-lg animate-pulse"
                : "border border-gray-200 bg-gray-50 hover:bg-gray-100"
            }`}
            style={
              listening
                ? { backgroundColor: "#137253" }
                : { color: "#137253" }
            }
            title={listening ? "Stop listening" : "Talk to Sprout"}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sprout anything..."
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:ring-2"
            style={{ "--tw-ring-color": "#137253" + "30" } as React.CSSProperties}
            disabled={loading || listening}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-all hover:shadow-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
            style={!loading && input.trim() ? { backgroundColor: "#137253" } : undefined}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
