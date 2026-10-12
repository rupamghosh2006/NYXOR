"use client";

import { useState } from "react";
import { Wrench, FastForward, Zap, ShieldAlert, Check, RefreshCw, KeyRound, Loader2 } from "lucide-react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import {
  CONTRACT_ADDRESSES,
  MARKET_CLOCK_ABI,
  PRICE_FEED_ABI,
  PERP_MARKET_ABI,
} from "../config/contracts";
import { shortenAddress } from "../lib/format";

interface AdminConsoleProps {
  isAdmin: boolean;
  onRefresh: () => void;
}

export function AdminConsole({ isAdmin, onRefresh }: AdminConsoleProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [isTxPending, setIsTxPending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [customShockBps, setCustomShockBps] = useState("-800");
  const [traderToDeleverage, setTraderToDeleverage] = useState("");

  // Helper to jump to a specific simulated timestamp
  const jumpToTargetTimestamp = async (targetTs: number) => {
    try {
      setIsTxPending(true);
      setStatusMsg("Calculating block offset...");
      const block = await publicClient?.getBlock();
      const currentBlockTs = Number(block?.timestamp || Math.floor(Date.now() / 1000));
      const neededOffset = BigInt(targetTs - currentBlockTs);

      setStatusMsg(`Setting clock offset (${neededOffset > 0n ? "+" : ""}${neededOffset}s)...`);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.MarketClock,
        abi: MARKET_CLOCK_ABI,
        functionName: "setDemoOffset",
        args: [neededOffset],
      });
      setStatusMsg(`Clock updated! Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        setStatusMsg(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Helper to advance simulated clock
  const handleAdvance = async (seconds: number) => {
    try {
      setIsTxPending(true);
      setStatusMsg(`Advancing clock by ${seconds}s...`);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.MarketClock,
        abi: MARKET_CLOCK_ABI,
        functionName: "advance",
        args: [BigInt(seconds)],
      });
      setStatusMsg(`Advanced! Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        setStatusMsg(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Apply Shock
  const handleShock = async (bps: number) => {
    try {
      setIsTxPending(true);
      setStatusMsg(`Applying ${bps / 100}% shock to Guarded feed...`);
      const h1 = await writeContractAsync({
        address: CONTRACT_ADDRESSES.MockPriceFeedGuarded,
        abi: PRICE_FEED_ABI,
        functionName: "queueShock",
        args: [BigInt(bps)],
      });
      setStatusMsg(`Applying ${bps / 100}% shock to Standard feed...`);
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.MockPriceFeedStandard,
        abi: PRICE_FEED_ABI,
        functionName: "queueShock",
        args: [BigInt(bps)],
      });
      setStatusMsg(`Shock applied! Tx: ${h1.slice(0, 10)}...`);
      setTimeout(() => {
        setStatusMsg(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Checkpoint Close
  const handleCheckpointClose = async () => {
    try {
      setIsTxPending(true);
      setStatusMsg("Recording official Friday close price on feeds...");
      const h1 = await writeContractAsync({
        address: CONTRACT_ADDRESSES.MockPriceFeedGuarded,
        abi: PRICE_FEED_ABI,
        functionName: "checkpointClose",
      });
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.MockPriceFeedStandard,
        abi: PRICE_FEED_ABI,
        functionName: "checkpointClose",
      });
      setStatusMsg(`Close Checkpointed! Tx: ${h1.slice(0, 10)}...`);
      setTimeout(() => {
        setStatusMsg(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Deleverage target trader
  const handleDeleverageTrader = async () => {
    if (!traderToDeleverage) return;
    try {
      setIsTxPending(true);
      setStatusMsg(`Running keeper deleveraging on ${shortenAddress(traderToDeleverage)}...`);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PerpMarketGuarded,
        abi: PERP_MARKET_ABI,
        functionName: "deleverageToCap",
        args: [traderToDeleverage as `0x${string}`],
      });
      setStatusMsg(`Deleveraged! Tx: ${hash.slice(0, 10)}...`);
      setTimeout(() => {
        setStatusMsg(null);
        onRefresh();
      }, 3000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0F1523] p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Wrench className="h-4 w-4 text-cyan-400" />
          <h3 className="font-bold text-white text-sm">
            Admin Time-Travel & Oracle Gap Controls
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
            HACKATHON DEMO
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          {isAdmin ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              <span>Admin Role Verified ({shortenAddress(address)})</span>
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5" />
              <span>Read-Only Mode</span>
            </span>
          )}
        </div>
      </div>

      {!isAdmin ? (
        <div className="mt-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-2">
          <p className="leading-relaxed">
            Time-travel simulation and oracle shock controls are locked for public wallets. To trigger on-chain time jumps and weekend gap shocks, connect the deployer address:
          </p>
          <div className="p-2.5 rounded bg-black/60 font-mono text-[11px] text-cyan-300 select-all border border-slate-800">
            {CONTRACT_ADDRESSES.Deployer}
          </div>
          <p className="text-[11px] text-slate-400">
            The full deterministic scenario has already been broadcast on Avalanche Fuji C-Chain, recording bad debt on the Standard Market and 0 on the Guarded Market.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Quick Time Travel */}
          <div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <FastForward className="h-3.5 w-3.5 text-cyan-400" />
              <span>Simulated Clock Jumps (UTC Session Schedule)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
              <button
                onClick={() => handleAdvance(600)}
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white transition-all text-center"
              >
                +10 Minutes
              </button>
              <button
                onClick={() => jumpToTargetTimestamp(1792182600)} // Friday 20:30 UTC
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition-all text-center"
              >
                Friday T-30m (Ramp)
              </button>
              <button
                onClick={() => jumpToTargetTimestamp(1792184100)} // Friday 20:55 UTC
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition-all text-center"
              >
                Friday T-5m (Keeper Window)
              </button>
              <button
                onClick={() => jumpToTargetTimestamp(1792238400)} // Saturday 12:00 UTC
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500/50 text-slate-300 hover:text-white transition-all text-center"
              >
                Weekend (Closed)
              </button>
              <button
                onClick={() => jumpToTargetTimestamp(1792420500)} // Monday 14:35 UTC
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 text-slate-300 hover:text-white transition-all text-center"
              >
                Monday Reopen
              </button>
              <button
                onClick={() => jumpToTargetTimestamp(Math.floor(Date.now() / 1000))}
                disabled={isTxPending}
                className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-all text-center"
              >
                Reset Clock
              </button>
            </div>
          </div>

          {/* Oracle & Shock Controls */}
          <div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Simulated Oracle Gap Shocks</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={() => handleShock(-800)}
                disabled={isTxPending}
                className="py-2.5 px-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900/60 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Apply -8.00% Weekend Shock</span>
              </button>

              <button
                onClick={handleCheckpointClose}
                disabled={isTxPending}
                className="py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-violet-500 text-slate-200 text-xs font-mono font-bold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Checkpoint Official Close</span>
              </button>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customShockBps}
                  onChange={(e) => setCustomShockBps(e.target.value)}
                  className="w-1/2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none"
                  placeholder="-800"
                />
                <button
                  onClick={() => handleShock(parseInt(customShockBps) || 0)}
                  disabled={isTxPending}
                  className="w-1/2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 transition-all"
                >
                  Custom Shock
                </button>
              </div>
            </div>
          </div>

          {/* Keeper Actions */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Keeper Pre-Close Deleveraging
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={traderToDeleverage}
                onChange={(e) => setTraderToDeleverage(e.target.value)}
                placeholder="Trader address to cut to 5x cap (e.g. 0x...)"
                className="w-3/4 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-100 focus:outline-none"
              />
              <button
                onClick={handleDeleverageTrader}
                disabled={isTxPending || !traderToDeleverage}
                className="w-1/4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-bold transition-all"
              >
                Deleverage to Cap
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 p-2.5 rounded-xl flex items-center gap-2">
              {isTxPending && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
