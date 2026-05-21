"use client";

import { useState } from "react";
import QueryInput from "@/components/QueryInput";
import InsightCard from "@/components/InsightCard";
import RootCauseCard from "@/components/RootCauseCard";
import AnomalyBadge from "@/components/AnomalyBadge";
import ConfidenceBar from "@/components/ConfidenceBar";
import EventExplanationPanel from "@/components/EventExplanationPanel";
import MitigationPanel from "@/components/MitigationPanel";
import HistoricalComparisonCard from "@/components/HistoricalComparisonCard";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Search, Database, BrainCircuit, CheckCircle2 } from "lucide-react";

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

// Extract anomaly_type_filter from free-text query
// Looks for any of the 4 known types mentioned in the query string
function extractAnomalyFilter(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("duplicate_pattern") || lower.includes("duplicate pattern")) return "duplicate_pattern";
  if (lower.includes("missing_events")    || lower.includes("missing events"))    return "missing_events";
  if (lower.includes("high_latency")      || lower.includes("high latency"))      return "high_latency";
  if (lower.includes("repetition"))                                                return "repetition";
  return undefined;
}

export default function Dashboard() {
  const [query, setQuery]       = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<AnalysisResult | null>(null);

  const handleAnalyze = async (input?: string) => {
    const finalQuery = input || query;

    if (!finalQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const trimmed = finalQuery.trim();

      // Detect whether user typed a bare block_id or a free-text / log query
      const isBlockId = trimmed.startsWith("blk_");

      let requestBody: Record<string, unknown>;
      if (isBlockId) {
        // PATH 1 — block_id lookup: uses precomputed embedding, gives best LLM output
        requestBody = { block_id: trimmed, k: 3 };
      } else {
        // PATH 2 — free-text query: keyword overlap retrieval
        // FIX: also send anomaly_type_filter when we can parse it from the query
        // so the backend restricts ChromaDB search to matching anomaly type
        const filter = extractAnomalyFilter(trimmed);
        requestBody = {
          query: trimmed,
          k: 3,
          ...(filter ? { anomaly_type_filter: filter } : {}),
        };
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/analyze`, {
        method: "POST",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`${response.status}: ${errText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Current structured API format
      const parsed: AnalysisResult = {
        summary:                data.summary                || "Analysis complete.",
        root_cause:             data.root_cause             || "Unknown root cause.",
        event_explanations:     data.event_explanations     || {},
        anomaly_type:           data.anomaly_type           || "unknown",
        confidence:             data.confidence             ?? 0.5,
        confidence_label:       data.confidence_label,
        comparison_to_historical: data.comparison_to_historical,
        retrieved_block_ids:    data.retrieved_block_ids    || [],
        query_block_id:         data.query_block_id,
        mitigation_steps:       data.mitigation_steps       || { high: [], medium: [], low: [] },
      };
      setResult(parsed);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze. Check backend is running.";
      console.error("API error:", err);
      setError(msg);
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
            <span className="text-[11px] text-slate-500 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/50">
              LLM-Powered
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Hint text */}
        <p className="text-xs text-slate-500 mb-3 ml-1">
          Tip: Paste a <span className="font-mono text-slate-400">blk_…</span> ID for exact lookup,
          or paste a full log query string for free-text analysis.
        </p>

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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="py-16 flex flex-col items-center gap-10">
                {/* Title */}
                <div className="flex flex-col items-center gap-2">
                  <motion.p
                    className="font-mono text-sm uppercase tracking-widest text-indigo-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    AI Pipeline Running
                  </motion.p>
                  <p className="text-xs text-slate-600">Retrieving similar cases · Generating root cause</p>
                </div>

                {/* Pipeline nodes */}
                <div className="flex items-center justify-center w-full max-w-2xl">
                  {[
                    { icon: Search,       label: "Query",  color: "blue",   delay: 0    },
                    { icon: Database,     label: "RAG",    color: "indigo", delay: 0.4  },
                    { icon: BrainCircuit, label: "LLM",    color: "purple", delay: 0.8  },
                    { icon: CheckCircle2, label: "Output", color: "green",  delay: 1.2  },
                  ].map((node, i, arr) => {
                    const colorMap: Record<string, { ring: string; bg: string; icon: string; dot: string; connector: string }> = {
                      blue:   { ring: "border-blue-500",   bg: "bg-blue-500/15",   icon: "text-blue-400",   dot: "bg-blue-400",   connector: "from-blue-500/40 to-indigo-500/40" },
                      indigo: { ring: "border-indigo-500", bg: "bg-indigo-500/15", icon: "text-indigo-400", dot: "bg-indigo-400", connector: "from-indigo-500/40 to-purple-500/40" },
                      purple: { ring: "border-purple-500", bg: "bg-purple-500/15", icon: "text-purple-400", dot: "bg-purple-400", connector: "from-purple-500/40 to-green-500/40" },
                      green:  { ring: "border-slate-700",  bg: "bg-slate-800",     icon: "text-green-400",  dot: "bg-green-400",  connector: "" },
                    };
                    const c = colorMap[node.color];
                    const Icon = node.icon;
                    return (
                      <div key={node.label} className="flex items-center flex-1 last:flex-none">
                        {/* Node */}
                        <motion.div
                          className="flex flex-col items-center gap-2 shrink-0"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: node.delay, duration: 0.4, type: "spring" }}
                        >
                          <div className={`relative w-14 h-14 rounded-full ${c.bg} border ${c.ring} flex items-center justify-center`}>
                            <Icon className={`w-6 h-6 ${c.icon}`} />
                            {/* Pulse ring */}
                            <motion.div
                              className={`absolute inset-0 rounded-full border ${c.ring}`}
                              animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
                              transition={{ repeat: Infinity, duration: 1.8, delay: node.delay }}
                            />
                          </div>
                          <span className={`text-[11px] font-medium ${c.icon}`}>{node.label}</span>
                        </motion.div>

                        {/* Connector (not after last node) */}
                        {i < arr.length - 1 && (
                          <div className={`flex-1 h-px mx-3 bg-gradient-to-r ${c.connector} relative overflow-hidden`}>
                            {/* Travelling dot */}
                            <motion.div
                              className={`absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full ${c.dot} shadow-lg`}
                              animate={{ left: ["-8px", "calc(100% + 8px)"] }}
                              transition={{ repeat: Infinity, duration: 1.4, delay: node.delay + 0.2, ease: "linear" }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Step labels */}
                <div className="flex gap-3">
                  {["Parsing query", "Embedding lookup", "Retrieving top-k", "Generating analysis"].map((step, i) => (
                    <motion.div
                      key={step}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 rounded-lg border border-slate-700/50"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: [0, 1, 0.4] }}
                      transition={{ delay: i * 0.6, duration: 1.2, repeat: Infinity, repeatDelay: 2.4 - i * 0.1 }}
                    >
                      <motion.div
                        className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                        animate={{ scale: [1, 1.6, 1] }}
                        transition={{ delay: i * 0.6, duration: 0.6, repeat: Infinity, repeatDelay: 2 }}
                      />
                      <span className="text-[11px] text-slate-400 font-mono">{step}</span>
                    </motion.div>
                  ))}
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

            {/* Root Cause + Anomaly + Confidence */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <RootCauseCard rootCause={result.root_cause} />
              </div>
              <div className="lg:col-span-1 flex flex-col gap-4">
                <AnomalyBadge type={result.anomaly_type} />
                <ConfidenceBar score={result.confidence} label={result.confidence_label} />
              </div>
            </div>

            {/* Historical Comparison — FIX: was never rendered */}
            {result.comparison_to_historical && (
              <HistoricalComparisonCard
                comparison={result.comparison_to_historical}
                similarBlocks={result.retrieved_block_ids}
              />
            )}

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
