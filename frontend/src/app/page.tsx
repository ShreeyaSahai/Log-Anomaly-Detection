"use client";

import { useState } from "react";
import QueryInput from "@/components/QueryInput";
import InsightCard from "@/components/InsightCard";
import RootCauseCard from "@/components/RootCauseCard";
import AnomalyBadge from "@/components/AnomalyBadge";
import ConfidenceBar from "@/components/ConfidenceBar";
import EventExplanationPanel from "@/components/EventExplanationPanel";
import MitigationPanel from "@/components/MitigationPanel";
//import { Activity, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Loader2,
  Search,
  Database,
  BrainCircuit,
  CheckCircle2
} from "lucide-react";

interface AnalysisResult {
  summary: string;
  root_cause: string;
  event_explanations?: Record<string, string>;
  anomaly_type: string;
  confidence: number;
  confidence_label?: string;
  comparison_to_historical?: string;
  retrieved_block_ids?: string[];
  query_block_id?: string;
  mitigation_steps: {
    high?: string[];
    medium?: string[];
    low?: string[];
  };
}

// Fallback event dictionary for legacy API responses
const EVENT_DICT: Record<string, string> = {
  E1: "Receiving block", E2: "Verification succeeded", E3: "Served block",
  E4: "Exception while serving", E5: "Receiving block (src→dest)",
  E6: "Unexpected error", E7: "writeBlock exception",
  E8: "PacketResponder exception", E9: "Received block (confirmed)",
  E10: "PacketResponder terminating", E11: "PacketResponder terminating",
  E20: "Error deleting block", E21: "Deleting block file",
  E22: "NameSystem allocateBlock", E23: "Block added to invalidSet",
  E26: "addStoredBlock: blockMap updated", E27: "Redundant addStoredBlock",
};

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const isBlockId = query.trim().startsWith("blk_");
      const requestBody = isBlockId ? { block_id: query.trim() } : { query: query.trim() };

      const response = await fetch(" https://hdfs-anomaly-api.onrender.com//analyze", {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // ── Structured API (new format) ──
      if (data.summary && data.root_cause) {
        const parsed: AnalysisResult = {
          summary: data.summary || "Analysis complete.",
          root_cause: data.root_cause || "Unknown",
          event_explanations: data.event_explanations || {},
          anomaly_type: data.anomaly_type || "Unknown",
          confidence: data.confidence ?? 0.5,
          confidence_label: data.confidence_label,
          comparison_to_historical: data.comparison_to_historical,
          retrieved_block_ids: data.retrieved_block_ids,
          query_block_id: data.query_block_id,
          mitigation_steps: data.mitigation_steps || { high: [], medium: [], low: [] },
        };
        setResult(parsed);
        return;
      }

      // ── Legacy API (llm_output markdown string) ──
      if (data.llm_output) {
        const text: string = data.llm_output;
        const parsed: AnalysisResult = {
          summary: "",
          root_cause: "Unknown Root Cause",
          anomaly_type: "System",
          confidence: 0.5,
          mitigation_steps: { high: [], medium: [], low: [] },
        };

        // Extract event codes mentioned in the text
        const eventCodes = new Set(text.match(/\bE\d+\b/g) || []);
        const eventExplanations: Record<string, string> = {};
        eventCodes.forEach((code) => {
          if (EVENT_DICT[code]) eventExplanations[code] = EVENT_DICT[code];
        });
        if (Object.keys(eventExplanations).length > 0) parsed.event_explanations = eventExplanations;

        // Also extract from similar_cases
        if (data.similar_cases) {
          for (const c of data.similar_cases) {
            const docCodes = (c.document || "").match(/\bE\d+\b/g) || [];
            docCodes.forEach((code: string) => {
              if (EVENT_DICT[code] && !eventExplanations[code]) {
                eventExplanations[code] = EVENT_DICT[code];
              }
            });
          }
          if (Object.keys(eventExplanations).length > 0) parsed.event_explanations = eventExplanations;
        }

        // Section boundaries
        const rcIdx = text.search(/root cause/i);
        const catIdx = text.search(/anomaly categor|anomaly type/i);
        const confIdx = text.search(/confidence/i);
        const mitIdx = text.search(/mitigation/i);

        const nextAfter = (cur: number, ...others: number[]) => {
          let end = text.length;
          for (const o of others) if (o > cur && o < end) end = o;
          return end;
        };

        // Root Cause
        if (rcIdx !== -1) {
          const end = nextAfter(rcIdx, catIdx, confIdx, mitIdx);
          let rc = text.substring(rcIdx, end).replace(/^[^\n:]*[:\n]\s*/, "").trim();
          const bold = rc.match(/\*\*([^*]{5,80})\*\*/);
          if (bold && !bold[1].toLowerCase().includes("root cause")) {
            parsed.root_cause = bold[1].trim();
            parsed.summary = rc.replace(/\*\*/g, "").trim();
          } else {
            const dot = rc.indexOf(". ");
            if (dot > 0 && dot < 250) {
              parsed.root_cause = rc.substring(0, dot + 1).replace(/\*\*/g, "").trim();
              parsed.summary = rc.substring(dot + 1).replace(/\*\*/g, "").trim();
            } else {
              parsed.root_cause = rc.substring(0, 150).replace(/\*\*/g, "").trim();
              parsed.summary = rc.replace(/\*\*/g, "").trim();
            }
          }
        }

        // Anomaly Category
        if (catIdx !== -1) {
          const end = nextAfter(catIdx, rcIdx, confIdx, mitIdx);
          const cat = text.substring(catIdx, end).replace(/^[^\n:]*[:\n]\s*/, "").replace(/\*/g, "").trim();
          parsed.anomaly_type = cat.split("\n")[0].trim() || "System";
        }

        // Confidence
        if (confIdx !== -1) {
          const end = nextAfter(confIdx, rcIdx, catIdx, mitIdx);
          const conf = text.substring(confIdx, end).toLowerCase();
          if (conf.includes("high")) { parsed.confidence = 0.95; parsed.confidence_label = "High"; }
          else if (conf.includes("medium")) { parsed.confidence = 0.65; parsed.confidence_label = "Medium"; }
          else if (conf.includes("low")) { parsed.confidence = 0.35; parsed.confidence_label = "Low"; }
        }

        // Mitigation Steps
        if (mitIdx !== -1) {
          let raw = text.substring(mitIdx).replace(/^[^\n:]*[:\n]\s*/, "").trim();
          const addIdx = raw.search(/additional recommend/i);
          if (addIdx > 0) raw = raw.substring(0, addIdx);

          const lines = raw.split(/\n/).map((l) => l.replace(/\*\*/g, "").trim()).filter((l) => l.length > 0);
          let cat: "high" | "medium" | "low" = "high";
          const stepCount = { high: 0, medium: 0, low: 0 };

          for (const line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes("high priority")) { cat = "high"; continue; }
            if (lower.includes("medium priority")) { cat = "medium"; continue; }
            if (lower.includes("low priority")) { cat = "low"; continue; }

            const clean = line.replace(/^[\*\-\d\.]+\s*/, "").trim();
            if (clean && clean.length > 5 && !lower.includes("priority") && !lower.includes("ordered by")) {
              parsed.mitigation_steps[cat]!.push(clean);
              stepCount[cat]++;
            }
          }

          // Auto-distribute if all steps fell into one bucket
          const h = parsed.mitigation_steps.high!;
          if (h.length >= 3 && !stepCount.medium && !stepCount.low) {
            parsed.mitigation_steps.high = h.slice(0, 2);
            parsed.mitigation_steps.medium = h.slice(2, 4);
            parsed.mitigation_steps.low = h.slice(4);
          }
        }

        setResult(parsed);
        return;
      }

      // Fallback: use data as-is
      setResult(data);
    } catch (err: any) {
      console.error("API error:", err);
      setError(err.message || "Failed to analyze query. Make sure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="bg-[#0f172a]/95 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-500/15 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              Log Anomaly Root Cause Analysis
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/50">LLM-Powered</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Query Input */}
        <div className="mb-10">
          <QueryInput query={query} setQuery={setQuery} onAnalyze={handleAnalyze} isLoading={isLoading} />
          {error && (
            <div className="mt-4 p-4 bg-red-500/8 border border-red-500/40 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <span className="font-semibold">⚠️ Error:</span> {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="py-16 flex flex-col items-center">

                <p className="text-slate-400 mb-8 font-mono text-sm uppercase tracking-widest animate-pulse">
                  AI Pipeline in Progress
                </p>

                <div className="flex items-center justify-center w-full max-w-4xl gap-4">

                  {/* Input */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center animate-pulse">
                      <Search className="text-blue-400" />
                    </div>
                    <span className="text-xs text-blue-300">Input</span>
                  </div>

                  {/* LINE */}
                  <div className="h-0.5 flex-1 bg-blue-500/30 relative">
                    <motion.div
                      className="absolute w-1/3 h-full bg-blue-400"
                      animate={{ left: ["-30%", "100%"] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    />
                  </div>

                  {/* RAG */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500 flex items-center justify-center relative">
                      <Database className="text-indigo-400" />
                      <div className="absolute w-14 h-14 border-2 border-indigo-400 rounded-full animate-ping" />
                    </div>
                    <span className="text-xs text-indigo-300">RAG</span>
                  </div>

                  {/* LINE */}
                  <div className="h-0.5 flex-1 bg-indigo-500/30 relative">
                    <motion.div
                      className="absolute w-1/3 h-full bg-indigo-400"
                      animate={{ left: ["-30%", "100%"] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: 0.5 }}
                    />
                  </div>

                  {/* LLM */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-purple-500/20 border border-purple-500 flex items-center justify-center">
                      <BrainCircuit className="text-purple-400" />
                    </div>
                    <span className="text-xs text-purple-300">LLM</span>
                  </div>

                  {/* LINE */}
                  <div className="h-0.5 flex-1 bg-purple-500/30 relative">
                    <motion.div
                      className="absolute w-1/3 h-full bg-purple-400"
                      animate={{ left: ["-30%", "100%"] }}
                      transition={{ repeat: Infinity, duration: 1.5, delay: 1 }}
                    />
                  </div>

                  {/* OUTPUT */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <CheckCircle2 className="text-green-400" />
                    </div>
                    <span className="text-xs text-slate-400">Output</span>
                  </div>

                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-6">
            {/* AI Insight */}
            <InsightCard summary={result.summary} />

            {/* Root Cause + Supporting Info */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <RootCauseCard rootCause={result.root_cause} />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-4">
                <AnomalyBadge type={result.anomaly_type} />
                <ConfidenceBar score={result.confidence} label={result.confidence_label} />
              </div>
            </div>

            {/* Event Explanations */}
            {result.event_explanations && Object.keys(result.event_explanations).length > 0 && (
              <EventExplanationPanel events={result.event_explanations} />
            )}

            {/* Mitigation Steps */}
            <MitigationPanel steps={result.mitigation_steps} />
          </div>
        )}

        {/* Empty State */}
        {!result && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-800/80 rounded-2xl text-slate-600 bg-slate-900/20">
            <Activity className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-base font-medium">Paste your logs or describe an anomaly to begin analysis</p>
            <p className="text-sm text-slate-700 mt-1">Results will appear here after clicking Analyze</p>
          </div>
        )}
      </main>
    </div>
  );
}
