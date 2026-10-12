"use client";

import { ExternalLink, BookOpen, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useReadContracts } from "wagmi";
import {
  CONTRACT_ADDRESSES,
  DEPLOYMENT_METADATA,
  LIQUIDITY_VAULT_ABI,
  PERP_MARKET_ABI,
} from "../config/contracts";
import { EXPLORER_BASE } from "../config/contracts";
import { formatUsdx } from "../lib/format";

/**
 * RecordedRun — read-only section, no wallet required.
 *
 * Sourcing policy:
 * - vaultAssets, insuranceFund, badDebtTotal: live on-chain reads from the
 *   Fuji contract. Updated every 6s.
 * - "Forge simulation" figures (e.g. the ">10,000 USDx bad debt" assertion):
 *   come from WeekendGapScenario.t.sol run with `forge test`, NOT from a
 *   live Fuji transaction.  The RunWeekendScenario.s.sol script was not
 *   broadcast on Fuji because the deployer AVAX balance was insufficient to
 *   fund 3 throwaway wallets at test time.  This is documented plainly.
 */
export function RecordedRun() {
  // Live on-chain reads — no wallet required.
  const { data, isLoading } = useReadContracts({
    contracts: [
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      {
        address: CONTRACT_ADDRESSES.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      {
        address: CONTRACT_ADDRESSES.PerpMarketStandard,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
      {
        address: CONTRACT_ADDRESSES.PerpMarketGuarded,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
    ],
    query: { refetchInterval: 6000 },
  });

  const stdVault    = data?.[0]?.result as bigint | undefined;
  const stdInsur    = data?.[1]?.result as bigint | undefined;
  const stdBadDebt  = data?.[2]?.result as bigint | undefined;
  const grdVault    = data?.[3]?.result as bigint | undefined;
  const grdInsur    = data?.[4]?.result as bigint | undefined;
  const grdBadDebt  = data?.[5]?.result as bigint | undefined;
  const stdOiLong   = data?.[6]?.result as bigint | undefined;
  const grdOiLong   = data?.[7]?.result as bigint | undefined;

  const explorerBase = EXPLORER_BASE;
  const isScenarioRun = stdBadDebt !== undefined && stdBadDebt > 0n;

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#0F1523] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <FileText className="h-4 w-4 text-cyan-400" />
          <div>
            <h2 className="font-bold text-white text-sm">
              Deployment Record & Scenario Results
            </h2>
            <p className="text-[11px] text-slate-400 font-mono">
              Fuji C-Chain · Chain ID 43113 · Deployed {DEPLOYMENT_METADATA.deployedAt.replace("T", " ").replace("Z", " UTC")}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          No wallet required
        </span>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Sourcing disclosure ───────────────────────────────────────────── */}
        <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/80 leading-relaxed space-y-1">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 mb-0.5">Data sourcing:</p>
              <p>
                <strong>Vault figures below (vaultAssets, insuranceFund, badDebtTotal) are live on-chain reads from the verified Fuji vault contracts</strong> — no hardcoding, refreshed every 6 seconds via <code className="text-amber-300">badDebtTotal()</code>.
              </p>
              <p className="mt-1">
                The weekend-gap scenario was run as a <strong>Foundry simulation</strong> (<code>forge test</code>) and as the <code>RunWeekendScenario.s.sol</code> script, <strong>not as a live Fuji broadcast</strong>. The on-chain vault bad debt currently shows 0 USDx because no scenario liquidation has been broadcast to Fuji yet. The Foundry test asserts standard bad debt &gt; 10,000 USDx and guarded bad debt = 0. See <code>docs/LIMITATIONS.md §Scenario</code>.
              </p>
            </div>
          </div>
        </div>

        {/* ── Live On-Chain Vault State ─────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Vault State (on-chain, no wallet)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Standard */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  Standard Vault (Naive 24/7)
                </div>
                <a
                  href={`${explorerBase}/address/${CONTRACT_ADDRESSES.LiquidityVaultStandard}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1"
                >
                  {CONTRACT_ADDRESSES.LiquidityVaultStandard.slice(0,8)}…
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
                  <span className="text-rose-300">Bad Debt Total</span>
                  <span className={stdBadDebt && stdBadDebt > 0n ? "text-rose-400 font-bold" : "text-slate-100"}>
                    {isLoading ? "…" : formatUsdx(stdBadDebt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OI Long</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(stdOiLong)}</span>
                </div>
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
                  href={`${explorerBase}/address/${CONTRACT_ADDRESSES.LiquidityVaultGuarded}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 text-[11px] font-mono flex items-center gap-1"
                >
                  {CONTRACT_ADDRESSES.LiquidityVaultGuarded.slice(0,8)}…
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
                  <span className="text-emerald-400">Bad Debt Total</span>
                  <span className="text-emerald-400 font-bold">{isLoading ? "…" : formatUsdx(grdBadDebt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">OI Long</span>
                  <span className="text-slate-100">{isLoading ? "…" : formatUsdx(grdOiLong)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Foundry Test Simulation Results ──────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
            Foundry Simulation Results (forge test — not live broadcast)
          </h3>

          <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-3 text-xs font-mono">
            {/* Scenario summary */}
            <div className="text-slate-300 leading-relaxed">
              <span className="text-cyan-400 font-bold">Scenario:</span> 5 traders open positions (20x, 20x, 10x, 10x, 15x long+short) on both markets from a 4,150.00 reference price. Keeper deleverages all Guarded positions to 5x cap at T-5min. A −8% Monday gap shock drops price to 3,818.00. Standard market liquidates 4 underwater positions.
            </div>
            <div className="border-t border-slate-800/60 pt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-rose-300 mb-1.5">Standard Market (Naive 24/7)</div>
                <div className="flex justify-between"><span className="text-slate-400">Bad Debt</span><span className="text-rose-400 font-bold">&gt;10,000 USDx</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Assertion</span><span className="text-slate-200">assertGt(stdBadDebt, 10_000e6) ✓</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Liquidations</span><span className="text-slate-200">4 underwater positions</span></div>
              </div>
              <div>
                <div className="text-violet-300 mb-1.5">Guarded Market (Nyxor Engine)</div>
                <div className="flex justify-between"><span className="text-slate-400">Bad Debt</span><span className="text-emerald-400 font-bold">0 USDx</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Assertion</span><span className="text-slate-200">assertEq(grdBadDebt, 0) ✓</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Liquidations</span><span className="text-slate-200">0 (all revert PositionHealthy)</span></div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 border-t border-slate-800/60 pt-2">
              Source: <code>test/scenario/WeekendGapScenario.t.sol::test_weekend_gap_scenario_deterministic</code> · 100 tests pass.
            </div>
          </div>
        </div>

        {/* ── Verified Contract Links ───────────────────────────────────────── */}
        <div>
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
            Verified Contract Links (Snowscan)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] font-mono">
            {[
              { label: "PerpMarketGuarded",     addr: CONTRACT_ADDRESSES.PerpMarketGuarded },
              { label: "PerpMarketStandard",    addr: CONTRACT_ADDRESSES.PerpMarketStandard },
              { label: "LiquidityVaultGuarded", addr: CONTRACT_ADDRESSES.LiquidityVaultGuarded },
              { label: "LiquidityVaultStd",     addr: CONTRACT_ADDRESSES.LiquidityVaultStandard },
              { label: "MarketHoursPolicy",     addr: CONTRACT_ADDRESSES.MarketHoursRiskPolicy },
              { label: "FlatRiskPolicy",        addr: CONTRACT_ADDRESSES.FlatRiskPolicy },
              { label: "MarketClock",           addr: CONTRACT_ADDRESSES.MarketClock },
              { label: "MarketSchedule",        addr: CONTRACT_ADDRESSES.MarketSchedule },
              { label: "MockFeedGuarded",       addr: CONTRACT_ADDRESSES.MockPriceFeedGuarded },
              { label: "MockFeedStandard",      addr: CONTRACT_ADDRESSES.MockPriceFeedStandard },
              { label: "DemoUSDC",              addr: CONTRACT_ADDRESSES.DemoUSDC },
            ].map(({ label, addr }) => (
              <a
                key={addr}
                href={`${explorerBase}/address/${addr}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 text-slate-300 hover:text-white transition-colors group"
              >
                <span className="truncate">{label}</span>
                <div className="flex items-center gap-1 shrink-0 text-slate-500 group-hover:text-cyan-400">
                  <span>{addr.slice(0,6)}…</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* ── Plain-language story ──────────────────────────────────────────── */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-400 leading-relaxed space-y-2">
          <p className="text-slate-300 font-semibold text-[13px]">
            What actually happened (plain language)
          </p>
          <p>
            All 11 contracts were compiled with Foundry and deployed to Avalanche Fuji C-Chain (ID 43113) from wallet <code className="text-cyan-300 text-[11px]">0x4AD1…1086</code> on 2026-10-12. Every contract was source-verified on Snowscan. The LP vaults were seeded with 1,000,000 USDx each.
          </p>
          <p>
            A deterministic weekend-gap scenario was run <strong>locally with Foundry</strong> (not broadcast to Fuji). It opened mirrored positions on both markets at 4,150 USD, had the Nyxor risk engine cut leverage to 5× before Friday close, applied a −8% Monday gap shock to 3,818 USD, then attempted liquidations. The Standard market accumulated bad debt (vault forced to absorb losses beyond collected collateral). The Guarded market survived with zero bad debt, all positions still healthy.
          </p>
          <p className="text-amber-400/80 text-[11px]">
            To see non-zero on-chain bad debt: connect the deployer wallet and use the Admin console to run the scenario against the live contracts, or wait until a real weekend gap is simulated via the time-travel controls.
          </p>
        </div>

      </div>
    </section>
  );
}
