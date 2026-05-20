"use client";

import { Search, Loader2, Sparkles } from "lucide-react";

interface QueryInputProps {
  query: string;
  setQuery: (val: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
}

export default function QueryInput({ query, setQuery, onAnalyze, isLoading }: QueryInputProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-3 bg-[#1e293b] p-2.5 rounded-2xl border border-slate-700/60 shadow-lg shadow-black/20 transition-all focus-within:border-indigo-500/60 focus-within:shadow-indigo-500/10">
        <div className="flex-1 flex items-center px-4 bg-[#0f172a] rounded-xl">
          <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
          <input
            type="text"
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 py-3.5 outline-none text-[15px]"
            placeholder="Describe anomaly or paste logs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && query.trim() && onAnalyze()}
            disabled={isLoading}
          />
        </div>
        <button
          onClick={onAnalyze}
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
    </div>
  );
}
