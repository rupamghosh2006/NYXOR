"use client";

import { useState, useEffect, useRef } from "react";
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
  // Smooth continuous anchored time ticker (completely immune to background polling resets)
  const [displaySecondsToClose, setDisplaySecondsToClose] = useState<bigint | undefined>(secondsToClose);
  const [displayEffectiveNow, setDisplayEffectiveNow] = useState<bigint | undefined>(effectiveNow);
  const [displaySecondsSinceOpen, setDisplaySecondsSinceOpen] = useState<bigint | undefined>(secondsSinceOpen);
  const anchorRef = useRef<{
    onChainEffective: number;
    onChainToClose: number;
    onChainSinceOpen: number;
    localAnchor: number;
  } | null>(null);

  useEffect(() => {
    if (effectiveNow !== undefined) {
      const nowMs = Date.now();
      const effNum = Number(effectiveNow);
      const closeNum = secondsToClose !== undefined ? Number(secondsToClose) : 0;
      const openNum = secondsSinceOpen !== undefined ? Number(secondsSinceOpen) : 0;

      if (!anchorRef.current) {
        anchorRef.current = {
          onChainEffective: effNum,
          onChainToClose: closeNum,
          onChainSinceOpen: openNum,
          localAnchor: nowMs,
        };
        setDisplayEffectiveNow(effectiveNow);
        setDisplaySecondsToClose(secondsToClose);
        setDisplaySecondsSinceOpen(secondsSinceOpen);
      } else {
        // If secondsToClose arrived in subsequent query
        if (closeNum > 0 && anchorRef.current.onChainToClose === 0) {
          anchorRef.current.onChainToClose = closeNum;
          anchorRef.current.localAnchor = nowMs;
          setDisplaySecondsToClose(secondsToClose);
        }
        if (openNum > 0 && anchorRef.current.onChainSinceOpen === 0) {
          anchorRef.current.onChainSinceOpen = openNum;
          setDisplaySecondsSinceOpen(secondsSinceOpen);
        }

        const elapsedSinceAnchor = Math.floor((nowMs - anchorRef.current.localAnchor) / 1000);
        const expectedEffective = anchorRef.current.onChainEffective + elapsedSinceAnchor;
        // Only resync if there was an actual jump (e.g. admin time travel > 4s), never on normal polling
        if (Math.abs(effNum - expectedEffective) > 4) {
          anchorRef.current = {
            onChainEffective: effNum,
            onChainToClose: closeNum,
            onChainSinceOpen: openNum,
            localAnchor: nowMs,
          };
          setDisplayEffectiveNow(effectiveNow);
          setDisplaySecondsToClose(secondsToClose);
          setDisplaySecondsSinceOpen(secondsSinceOpen);
        }
      }
    }
  }, [effectiveNow, secondsToClose, secondsSinceOpen]);

  // Smooth uninterrupted 1000ms clock heartbeat
  useEffect(() => {
    const timer = setInterval(() => {
      if (anchorRef.current) {
        const elapsed = Math.floor((Date.now() - anchorRef.current.localAnchor) / 1000);
        const currentEff = BigInt(anchorRef.current.onChainEffective + elapsed);
        setDisplayEffectiveNow(currentEff);

        if (anchorRef.current.onChainToClose > 0) {
          const remaining = anchorRef.current.onChainToClose - elapsed;
          setDisplaySecondsToClose(remaining > 0 ? BigInt(remaining) : 0n);
        }

        if (anchorRef.current.onChainSinceOpen > 0) {
          setDisplaySecondsSinceOpen(BigInt(anchorRef.current.onChainSinceOpen + elapsed));
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  // Countdown interpretation with active fallback
  const activeSecondsToClose = displaySecondsToClose ?? secondsToClose;
  const activeSecondsSinceOpen = displaySecondsSinceOpen ?? secondsSinceOpen;
  const activeEffectiveNow = displayEffectiveNow ?? effectiveNow;

  let countdownText = "--";
  let countdownSub = "";
  if (phase === 0) {
    // OPEN: countdown to close
    countdownText = `T - ${formatDuration(activeSecondsToClose)}`;
    countdownSub = "until session close";
  } else if (phase === 1) {
    // PRE_CLOSE: countdown to close
    countdownText = `T - ${formatDuration(activeSecondsToClose)}`;
    countdownSub = "until market closes";
  } else if (phase === 2) {
    // CLOSED: waiting for reopen
    countdownText = "WEEKEND SHUTDOWN";
    countdownSub = "reopens Mon 14:30 UTC";
  } else if (phase === 3) {
    // REOPEN_COOLDOWN: 900s - secondsSinceOpen
    const cooldownLeft = 900n > (activeSecondsSinceOpen || 0n) ? 900n - (activeSecondsSinceOpen || 0n) : 0n;
    countdownText = `T - ${formatDuration(cooldownLeft)}`;
    countdownSub = "cooldown remaining";
  }

  return (
    <div className="nyxor-card relative overflow-hidden rounded-[1.75rem] p-6 sm:p-7 transition-colors">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-center">
        {/* Hero Phase Pill */}
        <div className="md:col-span-1 flex flex-col gap-3">
          <div className="eyebrow flex items-center gap-2 text-neutral-500">
            <Shield className="h-3.5 w-3.5 text-[#d8ff3f]" />
            <span>Nyxor market state</span>
          </div>

          <div
            className={`inline-flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-lg ${phaseConfig.bgClass}`}
          >
            <span className={`h-3 w-3 rounded-full ${phaseConfig.dotClass}`} />
            <div>
              <div className="text-xl font-extrabold tracking-[-0.04em] mono-numbers">
                {phaseConfig.name}
              </div>
              <div className="eyebrow mt-0.5 opacity-80">
                {phaseConfig.badge}
              </div>
            </div>
          </div>

          <p className="max-w-sm text-xs text-neutral-400 leading-relaxed">
            {phaseConfig.description}
          </p>
        </div>

        {/* Dynamic Countdown & Simulated Clock */}
        <div className="md:col-span-1 flex flex-col items-start md:items-center justify-center rounded-2xl border border-white/10 bg-black/40 p-5 shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5 text-[#d8ff3f]" />
              <span>Simulated Clock</span>
            </div>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-mono text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live
            </span>
            {demoMode && (
              <span className="rounded-full border border-[#d8ff3f]/30 bg-[#d8ff3f]/10 px-1.5 py-0.5 text-[9px] text-[#d8ff3f] mono-numbers">
                DEMO
              </span>
            )}
          </div>

          <div className="mono-numbers text-3xl font-extrabold text-[#d8ff3f] tracking-tight tabular-nums drop-shadow-[0_0_12px_rgba(216,255,63,0.3)]">
            {countdownText}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-400 font-mono font-medium">{countdownSub}</div>

          <div className="mt-3.5 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-300 mono-numbers tabular-nums shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span>{formatUtcTime(activeEffectiveNow)}</span>
          </div>
        </div>

        {/* Dynamic Risk Meter for Guarded vs Naive */}
        <div className="md:col-span-1 flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
              <span>Nyxor Dynamic Leverage Cap</span>
              <span className="mono-numbers font-bold text-[#d8ff3f]">
                {formatLeverage(guardedMaxLev)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
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

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
            <div>
              <span className="text-neutral-500 text-[11px]">Mode</span>
              <div className="mono-numbers font-medium text-neutral-100">
                {guardedReduceOnly ? "Reduce-Only" : "Normal"}
              </div>
            </div>
            <div>
              <span className="text-neutral-500 text-[11px]">Naive market</span>
              <div className="mono-numbers font-medium text-rose-300">
                Static 20.00x
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
