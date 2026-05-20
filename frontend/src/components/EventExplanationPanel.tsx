"use client";

import { useState } from "react";
import { Zap, Info } from "lucide-react";

interface EventExplanationPanelProps {
  events: Record<string, string>;
}

export default function EventExplanationPanel({ events }: EventExplanationPanelProps) {
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);

  if (!events || Object.keys(events).length === 0) return null;

  const entries = Object.entries(events);

  return (
    <div className="w-full bg-[#1e293b] p-6 md:p-8 rounded-2xl border border-slate-700/60 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/15 rounded-lg">
          <Zap className="w-5 h-5 text-cyan-400" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 tracking-wide">Detected Event Patterns</h3>
        <span className="ml-auto text-[11px] text-slate-500 font-medium bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/50">
          {entries.length} events
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {entries.map(([eventId, explanation]) => (
          <div
            key={eventId}
            className="group relative"
            onMouseEnter={() => setHoveredEvent(eventId)}
            onMouseLeave={() => setHoveredEvent(null)}
          >
            <div className={`
              flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-default transition-all duration-200
              ${hoveredEvent === eventId
                ? "bg-cyan-500/15 border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                : "bg-slate-800/60 border-slate-700/50 hover:border-slate-600"
              }
            `}>
              <span className={`
                font-mono font-bold text-sm px-2 py-0.5 rounded-md
                ${hoveredEvent === eventId ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-700/50 text-slate-400"}
              `}>
                {eventId}
              </span>
              <span className="text-slate-500 text-sm">→</span>
              <span className={`text-sm font-medium ${hoveredEvent === eventId ? "text-cyan-200" : "text-slate-300"}`}>
                {explanation}
              </span>
            </div>

            {/* Tooltip on hover */}
            {hoveredEvent === eventId && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 border border-cyan-500/30 rounded-lg shadow-xl z-20 whitespace-nowrap">
                <div className="flex items-center gap-2 text-[12px]">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-200 font-medium">{eventId}</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-300">{explanation}</span>
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-cyan-500/30 rotate-45" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
