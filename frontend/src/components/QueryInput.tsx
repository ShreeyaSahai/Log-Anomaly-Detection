"use client";

import { Search, Loader2, Sparkles, FlaskConical } from "lucide-react";

interface QueryInputProps {
  query: string;
  setQuery: (val: string) => void;
  onAnalyze: (input?: string) => void;
  isLoading: boolean;
}

const EXAMPLE_QUERIES = [
  {
    label: "Duplicate Pattern",
    color: "text-violet-400 border-violet-500/30 hover:bg-violet-500/10",
    dot: "bg-violet-400",
    query:
      "HDFS block anomaly: duplicate_pattern. Latency: 7156ms. Total events: 20. Event sequence: E5 -> E5 -> E5 -> E22 -> E11 -> E9 -> E11 -> E9 -> E11 -> E9 -> E26 -> E26 -> E26 -> E23 -> E23 -> E23 -> E21 -> E20 -> E21 -> E21",
  },
  {
    label: "High Latency",
    color: "text-orange-400 border-orange-500/30 hover:bg-orange-500/10",
    dot: "bg-orange-400",
    query:
      "HDFS block anomaly: high_latency. Latency: 43200ms. Total events: 12. Event sequence: E5 -> E22 -> E9 -> E26 -> E11 -> E9 -> E26 -> E11 -> E25 -> E29 -> E17 -> E21",
  },
  {
    label: "Missing Events",
    color: "text-rose-400 border-rose-500/30 hover:bg-rose-500/10",
    dot: "bg-rose-400",
    query:
      "HDFS block anomaly: missing_events. Latency: 5300ms. Total events: 5. Event sequence: E5 -> E22 -> E7 -> E14 -> E21",
  },
  {
    label: "Repetition",
    color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10",
    dot: "bg-amber-400",
    query:
      "HDFS block anomaly: repetition. Latency: 11068ms. Total events: 18. Event sequence: E5 -> E9 -> E11 -> E5 -> E9 -> E11 -> E5 -> E9 -> E11 -> E26 -> E26 -> E26 -> E23 -> E23 -> E23 -> E21 -> E21 -> E21",
  },
];

export default function QueryInput({
  query,
  setQuery,
  onAnalyze,
  isLoading,
}: QueryInputProps) {
  const handleExample = (exampleQuery: string) => {
    setQuery(exampleQuery);

    // directly pass query instead of relying on async state update
    onAnalyze(exampleQuery);
  };

  return (
    <div className="w-full space-y-3">
      {/* Input row */}
      <div className="flex items-center gap-3 bg-[#1e293b] p-2.5 rounded-2xl border border-slate-700/60 shadow-lg shadow-black/20 transition-all focus-within:border-indigo-500/60 focus-within:shadow-indigo-500/10">
        <div className="flex-1 flex items-center px-4 bg-[#0f172a] rounded-xl">
          <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />

          <input
            type="text"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 py-3.5 outline-none text-[15px]"
            placeholder="Paste a blk_… ID or a full log query string…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isLoading && query.trim()) {
                onAnalyze(query);
              }
            }}
            disabled={isLoading}
          />
        </div>

        <button
          onClick={() => onAnalyze(query)}
          disabled={isLoading || !query.trim()}
          className="px-7 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center gap-2 transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 text-[15px]"
        >
          {isLoading ? (
            <Loader2 className="w-[18px] h-[18px] animate-spin" />
          ) : (
            <Sparkles className="w-[18px] h-[18px]" />
          )}

          {isLoading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {/* Example queries row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium uppercase tracking-wider mr-1">
          <FlaskConical className="w-3.5 h-3.5" />
          Try example:
        </div>

        {EXAMPLE_QUERIES.map((ex) => (
          <button
            key={ex.label}
            onClick={() => handleExample(ex.query)}
            disabled={isLoading}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-medium
              bg-transparent disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150 ${ex.color}
            `}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${ex.dot} shrink-0`}
            />

            {ex.label}
          </button>
        ))}
      </div>
    </div>
  );
}