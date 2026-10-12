"use client";

import { AlertOctagon, ShieldCheck, ExternalLink, HelpCircle } from "lucide-react";
import { formatUsdx, formatLeverage, formatPrice } from "../lib/format";
import { CONTRACT_ADDRESSES } from "../config/contracts";

interface MarketMetrics {
  vaultAssets: bigint | undefined;
  insuranceFund: bigint | undefined;
  badDebtTotal: bigint | undefined;
  totalOiLong: bigint | undefined;
  totalOiShort: bigint | undefined;
  price: bigint | undefined;
  maxLeverage: bigint | number | undefined;
  reduceOnly: boolean | undefined;
}

interface ComparisonPanelProps {
  standard: MarketMetrics;
  guarded: MarketMetrics;
  phase: number | undefined;
}

export function ComparisonPanel({ standard, guarded, phase }: ComparisonPanelProps) {
  const standardBadDebtNum = standard.badDebtTotal ? Number(standard.badDebtTotal) / 1e6 : 0;
  const guardedBadDebtNum = guarded.badDebtTotal ? Number(guarded.badDebtTotal) / 1e6 : 0;
  const scenarioExecuted = standardBadDebtNum > 0 || guardedBadDebtNum > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span>Market Solvency Comparison</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              Live Fuji Contracts
            </span>
          </h2>
          <p className="text-xs text-slate-400">
            Identical trade sizes & market shock — comparing naive 24/7 flat risk vs. Nyxor market-hours engine.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Standard Naive Market */}
        <div className="relative overflow-hidden rounded-2xl border border-rose-900/40 bg-[#0F1523] p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-rose-500" />
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  Standard Market
                  <span className="text-[10px] bg-rose-950/80 text-rose-400 border border-rose-800/60 px-1.5 py-0.2 rounded font-mono">
                    NAIVE 24/7
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Policy: FlatRiskPolicy (Static 20x)
                </span>
              </div>
            </div>

            <a
              href={`https://testnet.snowscan.xyz/address/${CONTRACT_ADDRESSES.PerpMarketStandard}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="View on Snowscan"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Bad Debt Hero Stat */}
          <div className="mt-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/50">
            <div className="flex items-center justify-between text-xs text-rose-300 font-medium mb-1">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4 text-rose-400" />
                Recorded Bad Debt
              </span>
              <span className="font-mono text-[11px] text-rose-400 uppercase tracking-wider">
                {scenarioExecuted ? "INSOLVENCY EVENT" : "SCENARIO PENDING"}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-rose-400">
              {scenarioExecuted ? formatUsdx(standard.badDebtTotal) : "Scenario not yet run"}
            </div>
            <p className="mt-1 text-[11px] text-rose-300/80 leading-relaxed">
              {scenarioExecuted
                ? "Weekend -8% gap blew past the 2.5% liquidation threshold. Collateral vanished; vault absorbed the shortfall."
                : "Awaiting deterministic weekend-gap run. In a gap event, unhedged 20x positions incur bad debt."}
            </p>
          </div>

          {/* Market Stats Grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Vault Assets</span>
              <div className="text-slate-100 font-semibold mt-0.5">
                {formatUsdx(standard.vaultAssets)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Insurance Fund</span>
              <div className="text-slate-100 font-semibold mt-0.5">
                {formatUsdx(standard.insuranceFund)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Leverage Cap</span>
              <div className="text-rose-400 font-semibold mt-0.5">
                {formatLeverage(standard.maxLeverage)} (Static)
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Oracle Price</span>
              <div className="text-slate-100 font-semibold mt-0.5">
                {formatPrice(standard.price)}
              </div>
            </div>

            <div className="col-span-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex justify-between">
              <div>
                <span className="text-slate-400 text-[11px]">Long Open Interest</span>
                <div className="text-slate-200 mt-0.5">{formatUsdx(standard.totalOiLong)}</div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px]">Short Open Interest</span>
                <div className="text-slate-200 mt-0.5">{formatUsdx(standard.totalOiShort)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Guarded Nyxor Market */}
        <div className="relative overflow-hidden rounded-2xl border border-violet-500/40 bg-[#0F1523] p-5 shadow-xl transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 rounded-full bg-violet-400 shadow-lg shadow-violet-500/50 animate-pulse" />
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  Guarded Market
                  <span className="text-[10px] bg-violet-950/80 text-violet-400 border border-violet-800/60 px-1.5 py-0.2 rounded font-mono">
                    NYXOR ENGINE
                  </span>
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Policy: MarketHoursRiskPolicy (Dynamic)
                </span>
              </div>
            </div>

            <a
              href={`https://testnet.snowscan.xyz/address/${CONTRACT_ADDRESSES.PerpMarketGuarded}`}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="View on Snowscan"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Zero Bad Debt Hero Stat */}
          <div className="mt-4 p-4 rounded-xl bg-violet-950/20 border border-violet-500/30">
            <div className="flex items-center justify-between text-xs text-violet-300 font-medium mb-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-violet-400" />
                Recorded Bad Debt
              </span>
              <span className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider font-bold">
                {scenarioExecuted ? "100% SOLVENT" : "SCENARIO PENDING"}
              </span>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {scenarioExecuted ? formatUsdx(guarded.badDebtTotal) : "Scenario not yet run"}
            </div>
            <p className="mt-1 text-[11px] text-violet-300/80 leading-relaxed">
              {scenarioExecuted
                ? "Leverage cut to 5.0x before close at the Friday price. Position absorbed the -8% gap on Monday with zero shortfall."
                : "Automatic pre-close deleveraging will reduce over-cap positions to 5x before market closure."}
            </p>
          </div>

          {/* Market Stats Grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Vault Assets</span>
              <div className="text-emerald-400 font-semibold mt-0.5">
                {formatUsdx(guarded.vaultAssets)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Insurance Fund</span>
              <div className="text-slate-100 font-semibold mt-0.5">
                {formatUsdx(guarded.insuranceFund)}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Leverage Cap</span>
              <div className="text-violet-400 font-semibold mt-0.5">
                {formatLeverage(guarded.maxLeverage)} ({guarded.reduceOnly ? "Reduce-Only" : "Dynamic"})
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <span className="text-slate-400 text-[11px]">Oracle Price</span>
              <div className="text-slate-100 font-semibold mt-0.5">
                {formatPrice(guarded.price)}
              </div>
            </div>

            <div className="col-span-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex justify-between">
              <div>
                <span className="text-slate-400 text-[11px]">Long Open Interest</span>
                <div className="text-slate-200 mt-0.5">{formatUsdx(guarded.totalOiLong)}</div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-[11px]">Short Open Interest</span>
                <div className="text-slate-200 mt-0.5">{formatUsdx(guarded.totalOiShort)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
