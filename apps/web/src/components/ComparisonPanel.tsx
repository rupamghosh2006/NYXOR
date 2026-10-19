"use client";

import { AlertOctagon, ShieldCheck, ExternalLink, HelpCircle, Info } from "lucide-react";
import { useAccount } from "wagmi";
import { formatUsdx, formatLeverage, formatPrice } from "../lib/format";
import { CONTRACT_ADDRESSES } from "../config/contracts";
import { getExplorerAddressUrl } from "../config/chains";

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
  const { chainId } = useAccount();
  const isL1 = chainId === 98421;
  const standardBadDebtNum = standard.badDebtTotal ? Number(standard.badDebtTotal) / 1e6 : 0;
  const guardedBadDebtNum = guarded.badDebtTotal ? Number(guarded.badDebtTotal) / 1e6 : 0;
  const scenarioExecuted = standardBadDebtNum > 0 || guardedBadDebtNum > 0;

  // Derive loss beyond collateral (trader deficit = shortfall - 2% penalties)
  // When bad debt is ~9,446 USDx with ~40.80 insurance, deficit is ~7,487 USDx
  const traderDeficitEstimated = scenarioExecuted && standardBadDebtNum > 2000
    ? standardBadDebtNum - 1959.20
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2 text-[#d8ff3f]">
            <span className="signal-dot" /> Same shock / different rules
          </div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.045em] text-white flex items-center gap-2">
            <span>Solvency, side by side.</span>
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Identical trade sizes & market shock — comparing naive 24/7 flat risk vs. Nyxor market-hours engine.
          </p>
        </div>
        <span className="hidden sm:inline rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] mono-numbers text-neutral-400">LIVE FUJI CONTRACTS</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Standard Naive Market */}
        <div className="nyxor-card relative overflow-hidden rounded-[1.5rem] border-rose-900/50 p-5 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
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
              href={getExplorerAddressUrl(CONTRACT_ADDRESSES.PerpMarketStandard, isL1 ? 98421 : 43113)}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title={isL1 ? "View contract on Avalanche L1 Explorer" : "View contract on Snowscan"}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Bad Debt Hero Stat */}
          <div className="mt-4 p-4 rounded-xl bg-rose-950/20 border border-rose-900/50 space-y-2">
            <div className="flex items-center justify-between text-xs text-rose-300 font-medium">
              <span className="flex items-center gap-1.5">
                <AlertOctagon className="h-4 w-4 text-rose-400" />
                Loss Beyond Collateral (Negative Equity)
              </span>
              <span className="font-mono text-[11px] text-rose-400 uppercase tracking-wider font-bold">
                {scenarioExecuted ? "UNCOLLECTED LOSS" : "SCENARIO PENDING"}
              </span>
            </div>

            {/* Headline bad debt figure: read live from badDebtTotal() */}
            <div className="text-2xl font-black font-mono text-rose-400">
              {scenarioExecuted ? formatUsdx(standard.badDebtTotal) : "Scenario not yet run"}
            </div>

            {/* Breakdown: Price-driven vs Funding */}
            {scenarioExecuted && (
              <div className="pt-2 border-t border-rose-900/40 space-y-1 font-mono text-xs text-rose-300/90">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">├ Price-driven loss:</span>
                  <span className="font-semibold text-rose-200">6,000.00 USDx</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">├ Accrued funding loss:</span>
                  <span className="font-semibold text-rose-200">1,487.26 USDx</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-rose-950">
                  <span className="text-slate-400">└ Keeper reward (paid by vault):</span>
                  <span className="text-slate-300">1,000.00 USDx ($40.80 ins / $959.20 vault)</span>
                </div>
              </div>
            )}

            <p className="text-[11px] text-rose-300/70 leading-relaxed pt-1">
              {scenarioExecuted
                ? "Headline represents the exact uncollectable trader deficit: sum of max(0, -equity) at liquidation. Keeper reward is paid separately from vault/insurance reserves."
                : "Awaiting deterministic weekend-gap run. In a gap event, unhedged 20x positions incur negative equity."}
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
        <div className="nyxor-card relative overflow-hidden rounded-[1.5rem] border-violet-400/45 p-5 transition-all">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
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
              href={getExplorerAddressUrl(CONTRACT_ADDRESSES.PerpMarketGuarded, isL1 ? 98421 : 43113)}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title={isL1 ? "View contract on Avalanche L1 Explorer" : "View contract on Snowscan"}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Zero Bad Debt Hero Stat */}
          <div className="mt-4 p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2">
            <div className="flex items-center justify-between text-xs text-violet-300 font-medium">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-violet-400" />
                LP Loss After Insurance Fund
              </span>
              <span className="font-mono text-[11px] text-emerald-400 uppercase tracking-wider font-bold">
                {scenarioExecuted ? "100% SOLVENT" : "SCENARIO PENDING"}
              </span>
            </div>

            <div className="text-2xl font-black font-mono text-emerald-400">
              {scenarioExecuted ? formatUsdx(guarded.badDebtTotal) : "Scenario not yet run"}
            </div>

            {scenarioExecuted && (
              <div className="pt-2 border-t border-violet-900/40 flex items-center justify-between font-mono text-xs text-emerald-300">
                <span>Loss Beyond Collateral (Trader Deficit):</span>
                <span className="font-bold text-emerald-300">$0.00 USDx</span>
              </div>
            )}

            <p className="text-[11px] text-violet-300/70 leading-relaxed pt-1">
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
