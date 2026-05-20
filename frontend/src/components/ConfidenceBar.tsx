interface ConfidenceBarProps {
  score: number;
  label?: string;
}

export default function ConfidenceBar({ score, label }: ConfidenceBarProps) {
  const s = score ?? 0;
  const percentage = s > 0 && s <= 1 ? Math.round(s * 100) : Math.round(s);

  let colorClass = "bg-emerald-500";
  let textColor = "text-emerald-400";
  let displayLabel = label || "High";

  if (percentage < 50) {
    colorClass = "bg-red-500";
    textColor = "text-red-400";
    displayLabel = label || "Low";
  } else if (percentage < 80) {
    colorClass = "bg-amber-500";
    textColor = "text-amber-400";
    displayLabel = label || "Medium";
  }

  return (
    <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/60 h-full flex flex-col justify-center shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.15em]">Confidence</h3>
        <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-slate-900/80 border border-slate-700/50 ${textColor}`}>
          {displayLabel}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-3xl font-bold text-slate-100">{percentage}%</div>
        <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50">
          <div
            className={`h-full ${colorClass} rounded-full transition-all duration-1000 ease-out`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
