"use client";

import { Shield, Clock, AlertTriangle, CheckCircle2, Lock, Flame } from "lucide-react";
import { formatDuration, formatLeverage, formatUtcTime } from "../lib/format";

interface PhaseHeroProps {
  phase: number | undefined;
  secondsToClose: bigint | undefined;
  secondsSinceOpen: bigint | undefined;
  effectiveNow: bigint | undefined;
  guardedMaxLev: bigint | number | undefined;
  guardedReduceOnly: boolean | undefined;
  demoMode: boolean | undefined;
}

export function PhaseHero({
  phase = 0,
  secondsToClose,
  secondsSinceOpen,
  effectiveNow,
  guardedMaxLev,
  guardedReduceOnly,
  demoMode,
}: PhaseHeroProps) {
  // Phase mapping
  const phaseConfig = [
    {
      name: "OPEN",
      badge: "NORMAL TRADING",
      color: "emerald",
      bgClass: "bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-emerald-950/50",
      dotClass: "bg-emerald-400 animate-pulse",
      description: "Full 20x leverage available. Standard 5.0% margin. Liquidations active.",
      icon: CheckCircle2,
    },
    {
      name: "PRE-CLOSE RAMP",
      badge: "DELEVERAGING REGIME",
      color: "amber",
      bgClass: "bg-amber-950/40 border-amber-500/40 text-amber-400 shadow-amber-950/50",
      dotClass: "bg-amber-400 animate-pulse",
      description: "Leverage ramping 20x → 5x. Final 10m: automated deleveraging at open-market price.",
      icon: Flame,
    },
    {
      name: "CLOSED",
      badge: "WEEKEND REGIME",
      color: "violet",
      bgClass: "bg-violet-950/40 border-violet-500/40 text-violet-400 shadow-violet-950/50",
      dotClass: "bg-violet-400",
      description: "Real equity market closed. Leverage capped at 5x. Over-cap positions reduce-only.",
      icon: Lock,
    },
    {
      name: "REOPEN COOLDOWN",
      badge: "GAP SETTLEMENT",
      color: "blue",
      bgClass: "bg-blue-950/40 border-blue-500/40 text-blue-400 shadow-blue-950/50",
      dotClass: "bg-blue-400 animate-pulse",
      description: "15-minute cooldown. Official open price registered. Liquidations active. Reduce-only.",
      icon: AlertTriangle,
    },
  ][phase] || {
    name: "UNKNOWN",
    badge: "SYNCING",
    color: "slate",
    bgClass: "bg-slate-900 border-slate-700 text-slate-400",
    dotClass: "bg-slate-500",
    description: "Loading risk policy state...",
    icon: Clock,
  };

  const Icon = phaseConfig.icon;

  // Countdown interpretation
  let countdownText = "--";
  let countdownSub = "";
  if (phase === 0) {
    // OPEN: countdown to close
    countdownText = `T - ${formatDuration(secondsToClose)}`;
    countdownSub = "until session close";
  } else if (phase === 1) {
    // PRE_CLOSE: countdown to close
    countdownText = `T - ${formatDuration(secondsToClose)}`;
    countdownSub = "until market closes";
  } else if (phase === 2) {
    // CLOSED: waiting for reopen
    countdownText = "WEEKEND SHUTDOWN";
    countdownSub = "reopens Mon 14:30 UTC";
  } else if (phase === 3) {
    // REOPEN_COOLDOWN: 900s - secondsSinceOpen
    const cooldownLeft = 900n > (secondsSinceOpen || 0n) ? 900n - (secondsSinceOpen || 0n) : 0n;
    countdownText = `T - ${formatDuration(cooldownLeft)}`;
    countdownSub = "cooldown remaining";
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0F1523]/80 p-6 shadow-2xl backdrop-blur-md">
      {/* Background glow matching active phase */}
      <div
        className={`absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-15 blur-3xl pointer-events-none ${
          phase === 0
            ? "bg-emerald-500"
            : phase === 1
            ? "bg-amber-500"
            : phase === 2
            ? "bg-violet-500"
            : "bg-blue-500"
        }`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Hero Phase Pill */}
        <div className="md:col-span-1 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <Shield className="h-4 w-4 text-violet-400" />
            <span>Market Hours Regime</span>
          </div>

          <div
            className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${phaseConfig.bgClass}`}
          >
            <span className={`h-3 w-3 rounded-full ${phaseConfig.dotClass}`} />
            <div>
              <div className="text-xl font-black tracking-tight font-mono">
                {phaseConfig.name}
              </div>
              <div className="text-[11px] font-semibold tracking-widest opacity-80 uppercase">
                {phaseConfig.badge}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {phaseConfig.description}
          </p>
        </div>

        {/* Dynamic Countdown & Simulated Clock */}
        <div className="md:col-span-1 flex flex-col items-start md:items-center justify-center p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 font-mono">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span>Simulated Market Clock</span>
            {demoMode && (
              <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/60 px-1.5 py-0.2 rounded font-mono">
                DEMO
              </span>
            )}
          </div>

          <div className="text-2xl font-bold font-mono text-white tracking-tight">
            {countdownText}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">{countdownSub}</div>

          <div className="mt-3 text-[11px] text-slate-400 font-mono bg-black/40 px-2.5 py-1 rounded border border-slate-800">
            {formatUtcTime(effectiveNow)}
          </div>
        </div>

        {/* Dynamic Risk Meter for Guarded vs Naive */}
        <div className="md:col-span-1 flex flex-col justify-between gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Nyxor Dynamic Leverage Cap</span>
              <span className="font-mono font-bold text-violet-400">
                {formatLeverage(guardedMaxLev)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  phase === 0
                    ? "bg-emerald-500 w-full"
                    : phase === 1
                    ? "bg-amber-500 w-[60%]"
                    : phase === 2
                    ? "bg-violet-500 w-[25%]"
                    : "bg-blue-500 w-[25%]"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60 text-xs">
            <div>
              <span className="text-slate-400 text-[11px]">Mode</span>
              <div className="font-mono font-medium text-slate-200">
                {guardedReduceOnly ? "Reduce-Only" : "Normal"}
              </div>
            </div>
            <div>
              <span className="text-slate-400 text-[11px]">Naive Market</span>
              <div className="font-mono font-medium text-rose-400">
                Static 20.00x
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
