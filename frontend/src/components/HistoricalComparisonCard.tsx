import { History, GitCommit } from "lucide-react";

interface HistoricalComparisonCardProps {
  comparison: string;
  similarBlocks?: string[];
}

export default function HistoricalComparisonCard({ comparison, similarBlocks }: HistoricalComparisonCardProps) {
  if (!comparison) return null;

  return (
    <div className="w-full bg-[#1e293b] p-6 rounded-2xl border border-blue-500/25 shadow-lg shadow-blue-500/5 relative overflow-hidden h-full">
      <div className="absolute top-0 right-0 w-1 h-full bg-gradient-to-b from-blue-400 to-blue-600 rounded-r-2xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/15 rounded-lg border border-blue-500/20">
            <History className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-[13px] font-semibold text-blue-200 tracking-wide uppercase">Historical Comparison</h3>
        </div>
        
        <p className="text-slate-300 leading-relaxed text-[15px] mb-5">{comparison}</p>
        
        {similarBlocks && similarBlocks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <GitCommit className="w-3 h-3" /> Similar Blocks Referenced
            </h4>
            <div className="flex flex-wrap gap-2">
              {similarBlocks.map((blockId, idx) => (
                <span key={idx} className="bg-[#0f172a] border border-blue-900/50 text-blue-300/80 px-2.5 py-1 rounded-md text-xs font-mono">
                  {blockId}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
