import { Lightbulb } from "lucide-react";

interface InsightCardProps {
  summary: string;
}

export default function InsightCard({ summary }: InsightCardProps) {
  return (
    <div className="w-full bg-[#1e293b] p-6 rounded-2xl border border-indigo-500/25 shadow-lg shadow-indigo-500/5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-400 to-indigo-600 rounded-l-2xl" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mt-10" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-500/15 rounded-lg">
            <Lightbulb className="w-5 h-5 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-indigo-200 tracking-wide uppercase text-[13px]">AI Insight</h3>
        </div>
        <p className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-wrap">{summary || "No insights available."}</p>
      </div>
    </div>
  );
}
