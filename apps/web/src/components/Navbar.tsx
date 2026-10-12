"use client";

import { Shield, ExternalLink, Wallet, Layers } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChainId, l1Chain, ACTIVE_CHAIN_NAME } from "../config/chains";
import { CONTRACT_ADDRESSES, EXPLORER_BASE } from "../config/contracts";
import { FUJI_CHAIN_ID } from "../config/contracts";
import { shortenAddress } from "../lib/format";

export function Navbar() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isWrongChain = isConnected && chainId !== activeChainId;
  const chainLabel = ACTIVE_CHAIN_NAME === "l1" ? "Nyxor L1" : "Fuji C-Chain";
  const chainPillClass =
    ACTIVE_CHAIN_NAME === "l1"
      ? "bg-violet-950/80 text-violet-300 border-violet-800/60"
      : "bg-cyan-950/80 text-cyan-300 border-cyan-800/60";

  return (
    <header className="border-b border-slate-800/80 bg-[#080B11]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo & Tagline */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 p-0.5 shadow-lg shadow-violet-600/30 flex items-center justify-center">
            <div className="h-full w-full bg-[#080B11] rounded-[10px] flex items-center justify-center">
              <Shield className="h-4.5 w-4.5 text-violet-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight text-white font-mono">NYXOR</span>
              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border uppercase ${chainPillClass}`}>
                {chainLabel}
              </span>
              {l1Chain && ACTIVE_CHAIN_NAME !== "l1" && (
                <span className="text-[10px] text-slate-500 font-mono">
                  (L1 via NEXT_PUBLIC_CHAIN=l1)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block leading-none">
              The market closes on Friday. Your risk shouldn't.
            </p>
          </div>
        </div>

        {/* Right: network indicator + contracts + wallet */}
        <div className="flex items-center gap-2.5">
          {/* Verified Contracts */}
          <a
            href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESSES.PerpMarketGuarded}`}
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono text-slate-300 transition-colors"
          >
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <span>Verified Contracts</span>
            <ExternalLink className="h-3 w-3 text-slate-500" />
          </a>

          {/* Connect / Switch chain */}
          {!isConnected ? (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-mono text-xs font-bold shadow-lg shadow-violet-600/20 transition-all"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </button>
          ) : isWrongChain ? (
            <button
              onClick={() => switchChain({ chainId: activeChainId })}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold shadow-lg shadow-rose-600/30 transition-all"
            >
              <span>Switch to {chainLabel}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-200">{shortenAddress(address)}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-[11px] font-mono text-slate-400 transition-colors"
                title="Disconnect"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
