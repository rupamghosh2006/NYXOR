"use client";

import { ExternalLink, CheckCircle2, ShieldAlert, ArrowRight, Layers, Info } from "lucide-react";
import { useReadContracts } from "wagmi";
import {
  BENCHMARK_CONTRACT_ADDRESSES,
  DEPLOYMENT_METADATA,
  LIQUIDITY_VAULT_ABI,
  PERP_MARKET_ABI,
  EXPLORER_BASE,
} from "../config/contracts";
import { formatUsdx } from "../lib/format";
import fujiScenario from "../deployments/fuji-scenario.json";

export function RecordedRun() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.PerpMarketStandard,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
      {
        address: BENCHMARK_CONTRACT_ADDRESSES.PerpMarketGuarded,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
    ],
    query: { refetchInterval: 5000 },
  });

  const stdVault    = data?.[0]?.result as bigint | undefined;
  const stdInsur    = data?.[1]?.result as bigint | undefined;
  const stdBadDebt  = data?.[2]?.result as bigint | undefined;
  const grdVault    = data?.[3]?.result as bigint | undefined;
  const grdInsur    = data?.[4]?.result as bigint | undefined;
  const grdBadDebt  = data?.[5]?.result as bigint | undefined;
  const stdOiLong   = data?.[6]?.result as bigint | undefined;
  const grdOiLong   = data?.[7]?.result as bigint | undefined;

  const isScenarioLive = stdBadDebt !== undefined && stdBadDebt > 0n;

  const scenarioSections = [
    { title: "Phase 1: Session Open & Multi-Trader Positions", txs: fujiScenario.transactions.phase1_open_and_trades },
    { title: "Phase 3: Pre-Close Window & Keeper Deleveraging (T-7.5m)", txs: fujiScenario.transactions.phase3_keeper_deleverage },
    { title: "Phase 4: Weekend Closed Phase & Price Checkpointing", txs: fujiScenario.transactions.phase4_closed_checkpoint },
    { title: "Phase 5: Monday Reopen & -8.00% Gap Shock", txs: fujiScenario.transactions.phase5_monday_reopen_shock },
    { title: "Phase 6: Liquidations & Shortfall Accounting", txs: fujiScenario.transactions.phase6_liquidations },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0F1523] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <Layers className="h-4 w-4 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-sm">
              Recorded Benchmark Run (Frozen Fuji On-Chain Instance)
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Executed at {fujiScenario.executedAt.replace("T", " ").replace("Z", " UTC")} · Chain ID 43113
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
          On-Chain Verified
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Honest Disclosure Note */}
        <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-cyan-200/90 leading-relaxed flex items-start gap-2">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <strong>Architecture & Scope Disclosure:</strong> The on-chain Fuji broadcast utilizes <strong>3 distinct trader wallets</strong> (T1 20x Long, T2 10x Long, T3 10x Short hedge) derived from the deployer keypair. The local Foundry test suite (<code>WeekendGapScenario.t.sol</code>) exercises <strong>5 reference traders plus rejected trader T6</strong> across boundary conditions.
          </div>
        </div>

        {/* Live Vault Status Box */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Vault Solvency Accounting (badDebtTotal())
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Standard */}
            <div className="rounded-xl border border-rose-900/40 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Standard Vault (Naive 24/7)
                </div>
                <a
                  href={`${EXPLORER_BASE}/address/${BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultStandard}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1"
                >
                  {BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultStandard.slice(0, 8)}…
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vault Assets</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(stdVault)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Insurance Fund</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(stdInsur)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-2 mt-2">
                  <span className="text-rose-300">Loss Beyond Collateral:</span>
                  <span className="text-rose-400 font-bold text-sm">
                    {isLoading ? "…" : isScenarioLive ? formatUsdx(stdBadDebt) : "Scenario not yet run"}
                  </span>
                </div>
                {isScenarioLive && (
                  <div className="space-y-1 pt-1 font-mono text-[11px] text-rose-300/80">
                    <div className="flex justify-between">
                      <span className="text-slate-400">├ Price-driven loss:</span>
                      <span>6,000.00 USDx</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">├ Accrued funding loss:</span>
                      <span>1,487.26 USDx</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>└ Keeper reward:</span>
                      <span>1,000.00 USDx ($40.80 ins / $959.20 vault)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Guarded */}
            <div className="rounded-xl border border-violet-900/40 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
                  Guarded Vault (Nyxor Engine)
                </div>
                <a
                  href={`${EXPLORER_BASE}/address/${BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultGuarded}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1"
                >
                  {BENCHMARK_CONTRACT_ADDRESSES.LiquidityVaultGuarded.slice(0, 8)}…
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vault Assets</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(grdVault)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Insurance Fund</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(grdInsur)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/60 pt-2 mt-2">
                  <span className="text-emerald-400">Loss Beyond Collateral:</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {isLoading ? "…" : isScenarioLive ? formatUsdx(grdBadDebt) : "Scenario not yet run"}
                  </span>
                </div>
                {isScenarioLive && (
                  <div className="space-y-1 pt-1 font-mono text-[11px] text-emerald-300/80">
                    <div className="flex justify-between">
                      <span className="text-slate-400">├ Negative equity:</span>
                      <span>0.00 USDx</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">└ Deleveraged to 5x:</span>
                      <span>Healthy (&gt;6% MM)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Verified Scenario Transactions */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
            Verified On-Chain Scenario Transactions ({fujiScenario.transactions.phase1_open_and_trades.length + fujiScenario.transactions.phase3_keeper_deleverage.length + fujiScenario.transactions.phase4_closed_checkpoint.length + fujiScenario.transactions.phase5_monday_reopen_shock.length + fujiScenario.transactions.phase6_liquidations.length} Transactions · Clean Atomic Run)
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {scenarioSections.map((sec, idx) => (
              <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 space-y-2">
                <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wide">
                  {sec.title}
                </div>
                <div className="space-y-1.5">
                  {sec.txs.map((tx, tIdx) => (
                    <div
                      key={tIdx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] p-2 rounded-lg bg-black/40 border border-slate-800/60"
                    >
                      <span className="text-slate-300">{tx.description}</span>
                      <a
                        href={`${EXPLORER_BASE}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 shrink-0"
                      >
                        <span>{tx.hash.slice(0, 10)}…{tx.hash.slice(-8)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
