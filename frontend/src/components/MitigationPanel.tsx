import { AlertTriangle, Info, CheckCircle2, ShieldCheck } from "lucide-react";

interface MitigationSteps {
  high?: string[];
  medium?: string[];
  low?: string[];
}

interface MitigationPanelProps {
  steps: MitigationSteps;
}

export default function MitigationPanel({ steps }: MitigationPanelProps) {
  if (!steps) return null;

  const hasSteps = (steps.high?.length || 0) + (steps.medium?.length || 0) + (steps.low?.length || 0) > 0;
  if (!hasSteps) return null;

  const categories = [
    {
      key: "high" as const,
      label: "HIGH PRIORITY",
      icon: AlertTriangle,
      items: Array.isArray(steps.high) ? steps.high : (steps.high ? [steps.high as unknown as string] : []),
      accentColor: "text-red-400",
      borderColor: "border-red-500/30",
      barColor: "bg-red-500",
      dotColor: "bg-red-400",
      dotGlow: "shadow-[0_0_6px_rgba(248,113,113,0.8)]",
      emoji: "🔴",
    },
    {
      key: "medium" as const,
      label: "MEDIUM PRIORITY",
      icon: Info,
      items: Array.isArray(steps.medium) ? steps.medium : (steps.medium ? [steps.medium as unknown as string] : []),
      accentColor: "text-amber-400",
      borderColor: "border-amber-500/30",
      barColor: "bg-amber-500",
      dotColor: "bg-amber-400",
      dotGlow: "shadow-[0_0_6px_rgba(251,191,36,0.8)]",
      emoji: "🟡",
    },
    {
      key: "low" as const,
      label: "LOW PRIORITY",
      icon: CheckCircle2,
      items: Array.isArray(steps.low) ? steps.low : (steps.low ? [steps.low as unknown as string] : []),
      accentColor: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      barColor: "bg-emerald-500",
      dotColor: "bg-emerald-400",
      dotGlow: "shadow-[0_0_6px_rgba(52,211,153,0.8)]",
      emoji: "🟢",
    },
  ];

  return (
    <div className="w-full bg-[#1e293b] p-6 md:p-8 rounded-2xl border border-slate-700/60 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-700/40 rounded-lg">
          <ShieldCheck className="w-5 h-5 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-100 tracking-wide">Mitigation Steps</h3>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => {
          if (!cat.items || cat.items.length === 0) return null;
          const Icon = cat.icon;
          return (
            <div key={cat.key} className={`bg-[#0f172a]/70 p-5 rounded-xl border ${cat.borderColor} relative overflow-hidden`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${cat.barColor}`} />
              <div className={`flex items-center gap-2 mb-3 ${cat.accentColor} ml-2`}>
                <Icon className="w-4 h-4" />
                <h4 className="font-bold uppercase tracking-[0.15em] text-[11px]">{cat.emoji} {cat.label}</h4>
              </div>
              <ul className="space-y-2.5 ml-2">
                {cat.items.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <span className={`w-1.5 h-1.5 rounded-full ${cat.dotColor} mt-2 shrink-0 ${cat.dotGlow}`} />
                    <span className="leading-relaxed text-[14px]">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
