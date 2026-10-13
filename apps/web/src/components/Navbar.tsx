"use client";

import Image from "next/image";
import { ExternalLink, Wallet, Layers, ArrowUpRight } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChainId, ACTIVE_CHAIN_NAME } from "../config/chains";
import { CONTRACT_ADDRESSES, EXPLORER_BASE } from "../config/contracts";
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
      ? "border-violet-400/40 bg-violet-400/10 text-violet-200"
      : "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070707]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3 group shrink-0" aria-label="Nyxor Protocol home">
          <div className="logo-frame h-10 w-10 rounded-full transition-transform duration-300 group-hover:rotate-6">
            <Image src="/nyxor-mark.png" alt="Nyxor mark" fill sizes="40px" className="object-cover" priority />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] font-extrabold tracking-[0.13em] text-white">NYXOR</span>
              <span className={`eyebrow rounded-full border px-2 py-1 ${chainPillClass}`}>
                {chainLabel}
              </span>
            </div>
            <p className="hidden sm:block mt-0.5 text-[10px] tracking-[0.02em] text-neutral-500">
              Risk engine for the hours that markets sleep.
            </p>
          </div>
        </a>

        <nav className="hidden lg:flex items-center gap-6 text-[11px] font-medium tracking-[0.08em] uppercase text-neutral-500">
          <a className="transition-colors hover:text-white" href="#protocol">Protocol</a>
          <a className="transition-colors hover:text-white" href="#comparison">Risk engine</a>
          <a className="transition-colors hover:text-white" href="#evidence">Evidence</a>
          <a className="transition-colors hover:text-white" href="#trade">Trade</a>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESSES.PerpMarketGuarded}`}
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-[10px] font-medium tracking-[0.08em] uppercase text-neutral-300 transition-all hover:border-white/35 hover:text-white"
          >
            <Layers className="h-3.5 w-3.5 text-[#d8ff3f]" />
            <span>Contracts</span>
            <ExternalLink className="h-3 w-3 text-neutral-500" />
          </a>

          {!isConnected ? (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="flex items-center gap-2 rounded-full bg-[#d8ff3f] px-4 py-2.5 text-[11px] font-extrabold tracking-[0.05em] text-black transition-all hover:bg-[#e5ff7a] hover:scale-[1.02]"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </button>
          ) : isWrongChain ? (
            <button
              onClick={() => switchChain({ chainId: activeChainId })}
              className="flex items-center gap-2 rounded-full bg-rose-500 px-4 py-2.5 text-[11px] font-extrabold tracking-[0.05em] text-white transition-all hover:bg-rose-400"
            >
              <span>Switch to {chainLabel}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-3 py-2 text-[11px] mono-numbers">
                <span className="signal-dot" />
                <span className="text-neutral-100">{shortenAddress(address)}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="rounded-full border border-white/10 px-2.5 py-2 text-[11px] text-neutral-500 transition-colors hover:border-white/25 hover:text-white"
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
