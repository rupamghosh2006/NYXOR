"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, Wallet, X } from "lucide-react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { activeChainId, ACTIVE_CHAIN_NAME } from "../config/chains";
import { shortenAddress } from "../lib/format";

const primaryLinks = [
  ["Overview", "/"],
  ["Protocol", "/protocol"],
  ["Risk engine", "/risk"],
] as const;

const exploreLinks = [
  {
    href: "/trade",
    title: "Trading terminal",
    description: "Open and manage an isolated-margin position.",
  },
  {
    href: "/demo",
    title: "Weekend scenario",
    description: "Run the guarded-versus-standard gap simulation.",
  },
  {
    href: "/evidence",
    title: "On-chain evidence",
    description: "Review recorded scenario results and proof.",
  },
  {
    href: "/bridge",
    title: "Collateral bridge",
    description: "Follow collateral from Fuji to Nyxor L1.",
  },
  {
    href: "/compliance",
    title: "Access controls",
    description: "Inspect the L1 transaction allowlist.",
  },
  {
    href: "/protocol#market-hours",
    title: "Market schedule",
    description: "Understand the clock that governs each risk phase.",
  },
] as const;

export function Navbar() {
  const { address, isConnected, chainId } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isL1 = chainId === 98421 || (chainId === undefined && ACTIVE_CHAIN_NAME === "l1");
  const isWrongChain = isConnected && chainId !== activeChainId;
  const expectedNetwork = isL1 ? "Nyxor L1" : "Fuji C-Chain";

  const closeMenus = () => {
    setExploreOpen(false);
    setMobileMenuOpen(false);
  };

  const walletControl = !isConnected ? (
    <button
      onClick={() => connectors[0] && connect({ connector: connectors[0] })}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#f4f4f0] px-5 text-[13px] font-bold text-[#0a0a0a] transition hover:-translate-y-0.5 hover:bg-white"
    >
      <Wallet className="h-4 w-4" />
      Connect wallet
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  ) : isWrongChain ? (
    <button
      onClick={() => switchChain({ chainId: activeChainId })}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#f4f4f0] px-5 text-[13px] font-bold text-[#0a0a0a] transition hover:-translate-y-0.5 hover:bg-white"
    >
      Switch to {expectedNetwork}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  ) : (
    <div className="flex items-center gap-2">
      <button
        onClick={() => switchChain({ chainId: isL1 ? 43113 : 98421 })}
        className="hidden h-12 rounded-xl border border-white/15 px-3 text-[11px] text-neutral-300 transition hover:border-white/35 hover:text-white sm:inline-flex sm:items-center"
        title={`Switch network to ${isL1 ? "Fuji C-Chain" : "Nyxor L1"}`}
      >
        {isL1 ? "L1" : "Fuji"}
      </button>
      <div className="flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-[11px] mono-numbers text-neutral-100">
        <span className="signal-dot" />
        {shortenAddress(address)}
      </div>
      <button
        onClick={() => disconnect()}
        className="hidden h-12 rounded-xl border border-white/10 px-3 text-[11px] text-neutral-500 transition hover:border-white/25 hover:text-white sm:inline-flex sm:items-center"
        title="Disconnect wallet"
      >
        Disconnect
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090909]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[88px] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-3" aria-label="Nyxor Protocol home" onClick={closeMenus}>
          <div className="logo-frame relative h-12 w-12 overflow-hidden rounded-[0.8rem] border border-white/20 bg-white/[0.04] transition-transform duration-300 group-hover:rotate-3">
            <Image src="/nyxor-mark.png" alt="Nyxor mark" fill sizes="48px" className="object-cover" priority />
          </div>
          <span className="text-lg font-extrabold tracking-[-0.06em] text-white sm:text-xl">NYXOR</span>
        </Link>

        <nav className="hidden items-center gap-8 text-[15px] font-medium text-neutral-400 lg:flex" aria-label="Primary navigation">
          {primaryLinks.map(([label, href]) => (
            <Link key={href} href={href} className="transition-colors hover:text-white" onClick={() => setExploreOpen(false)}>
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setExploreOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 text-neutral-400 transition-colors hover:text-white"
            aria-expanded={exploreOpen}
            aria-controls="explore-menu"
          >
            Explore
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${exploreOpen ? "rotate-180" : ""}`} />
          </button>
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          <Link
            href="/evidence"
            className="hidden text-[15px] font-medium text-neutral-300 transition-colors hover:text-white xl:block"
            onClick={() => setExploreOpen(false)}
          >
            Documentation
          </Link>
          <div className="hidden sm:block">{walletControl}</div>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((open) => !open);
              setExploreOpen(false);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-neutral-300 transition hover:border-white/35 hover:text-white lg:hidden"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {exploreOpen && (
        <div
          id="explore-menu"
          className="absolute left-1/2 top-[88px] hidden w-[min(760px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#181817] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.55)] lg:block"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {exploreLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setExploreOpen(false)}
                className="rounded-xl px-4 py-3.5 transition hover:bg-white/[0.055]"
              >
                <p className="text-[15px] font-semibold tracking-[-0.02em] text-white">{item.title}</p>
                <p className="mt-1 text-[13px] leading-5 text-neutral-500">{item.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <nav className="border-t border-white/10 bg-[#0b0b0b] px-4 py-4 lg:hidden" aria-label="Mobile navigation">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 text-sm font-medium text-neutral-300">
            {[...primaryLinks, ...exploreLinks.map(({ title, href }) => [title, href] as const)].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenus}
                className="rounded-xl border border-white/10 bg-white/[0.025] px-3 py-3 transition hover:border-white/35 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mx-auto mt-3 max-w-7xl sm:hidden">{walletControl}</div>
        </nav>
      )}
    </header>
  );
}
