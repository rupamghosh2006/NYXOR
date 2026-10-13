"use client";

import { AlertTriangle, Info } from "lucide-react";

export function Banner({ demoMode }: { demoMode: boolean | undefined }) {
  if (!demoMode) return null;

  return (
    <div className="border-b border-[#d8ff3f]/20 bg-[#d8ff3f]/[0.07] px-4 py-2.5 text-xs mono-numbers text-neutral-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertTriangle className="h-4 w-4 text-[#d8ff3f] shrink-0 animate-pulse" />
          <span>
            <strong className="text-[#d8ff3f] font-bold tracking-wide">
              SIMULATED CLOCK & ORACLE (DEMO MODE):
            </strong>{" "}
            Prices and session offsets are simulated on Fuji C-Chain for deterministic weekend-gap testing. Contract math, dynamic policies, and LP vaults are fully live.
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <Info className="h-3.5 w-3.5 shrink-0 text-[#d8ff3f]" />
          <span>Fuji Chain ID: 43113</span>
        </div>
      </div>
    </div>
  );
}
