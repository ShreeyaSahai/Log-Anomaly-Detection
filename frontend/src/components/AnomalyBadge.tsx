import { Activity, Globe, Database, Shield, Cpu, Server } from "lucide-react";

interface AnomalyBadgeProps {
  type: string;
}

export default function AnomalyBadge({ type }: AnomalyBadgeProps) {
  const getBadgeStyle = (t: string) => {
    const lower = (t || "unknown").toLowerCase();
    if (lower.includes("network")) return { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25", label: "🌐 Network" };
    if (lower.includes("database") || lower.includes("db")) return { icon: Database, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25", label: "🗄️ Database" };
    if (lower.includes("security") || lower.includes("auth")) return { icon: Shield, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/25", label: "🔒 Security" };
    if (lower.includes("resource") || lower.includes("cpu") || lower.includes("memory")) return { icon: Cpu, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", label: "⚡ Resource" };
    if (lower.includes("system")) return { icon: Server, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/25", label: "🖥️ System" };
    return { icon: Activity, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/25", label: `📋 ${t}` };
  };

  const style = getBadgeStyle(type);
  const Icon = style.icon;

  return (
    <div className="bg-[#1e293b] p-5 rounded-2xl border border-slate-700/60 h-full flex flex-col justify-center shadow-md">
      <h3 className="text-[11px] font-semibold text-slate-500 mb-3 uppercase tracking-[0.15em]">Anomaly Type</h3>
      <div className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full border ${style.bg} ${style.border} w-max`}>
        <Icon className={`w-4 h-4 ${style.color}`} />
        <span className={`font-semibold text-sm ${style.color}`}>{style.label}</span>
      </div>
    </div>
  );
}
