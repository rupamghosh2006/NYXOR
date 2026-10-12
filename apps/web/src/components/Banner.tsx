"use client";

import { AlertTriangle, Info } from "lucide-react";

export function Banner({ demoMode }: { demoMode: boolean | undefined }) {
  if (!demoMode) return null;

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-slate-900/90 to-cyan-950/80 border-b border-amber-500/20 py-2.5 px-4 text-xs font-mono text-amber-200/90 shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
          <span>
            <strong className="text-amber-300 font-bold tracking-wide">
              SIMULATED CLOCK & ORACLE (DEMO MODE):
            </strong>{" "}
            Prices and session offsets are simulated on Fuji C-Chain for deterministic weekend-gap testing. Contract math, dynamic policies, and LP vaults are fully live.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-cyan-300">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>Fuji Chain ID: 43113</span>
        </div>
      </div>
    </div>
  );
}
