import { AlertOctagon } from "lucide-react";

interface RootCauseCardProps {
  rootCause: string;
}

export default function RootCauseCard({ rootCause }: RootCauseCardProps) {
  return (
    <div className="w-full bg-gradient-to-br from-red-950/50 to-orange-950/30 border border-red-500/40 p-8 rounded-2xl shadow-xl shadow-red-500/5 relative overflow-hidden h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-orange-500/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center text-red-400 border border-red-500/20 shadow-lg shadow-red-500/10">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-red-400/90 text-[13px] font-bold uppercase tracking-[0.15em]">Root Cause Identified</h3>
            <p className="text-slate-400 text-xs mt-0.5">Determined by LLM Analysis</p>
          </div>
        </div>
        <p className="text-[16px] md:text-[17px] text-slate-200 leading-relaxed font-medium">
          {rootCause || "Unknown Root Cause"}
        </p>
      </div>
    </div>
  );
}
