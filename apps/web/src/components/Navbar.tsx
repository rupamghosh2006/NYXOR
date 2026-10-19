"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ArrowUpRight, ChevronDown, Menu, Wallet, X, Check } from "lucide-react";
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
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const isL1 = chainId === 98421;
  const isFuji = chainId === 43113;
  const isSupportedChain = isL1 || isFuji;
  const isWrongChain = isConnected && !isSupportedChain;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNetworkDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeMenus = () => {
    setExploreOpen(false);
    setMobileMenuOpen(false);
    setNetworkDropdownOpen(false);
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
      onClick={() => switchChain({ chainId: 98421 })}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#f4f4f0] px-5 text-[13px] font-bold text-[#0a0a0a] transition hover:-translate-y-0.5 hover:bg-white"
    >
      Switch to Nyxor L1
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  ) : (
    <div className="flex items-center gap-2">
      {/* Network Selector Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setNetworkDropdownOpen((open) => !open)}
          className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-[12px] font-medium text-neutral-200 transition hover:border-white/35 hover:bg-white/[0.08]"
          title="Switch Network"
          aria-expanded={networkDropdownOpen}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isL1
                ? "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]"
                : "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            }`}
          />
          <span className="mono-numbers font-semibold">{isL1 ? "Nyxor L1" : "Fuji C-Chain"}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${
              networkDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {networkDropdownOpen && (
          <div className="absolute right-0 top-14 z-50 w-56 rounded-2xl border border-white/15 bg-[#141413] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
              Select Network
            </div>
            <button
              type="button"
              onClick={() => {
                if (!isL1) {
                  switchChain({ chainId: 98421 });
                }
                setNetworkDropdownOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                isL1
                  ? "bg-white/10 text-white font-semibold"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                <div>
                  <div className="text-white font-medium">Nyxor L1</div>
                  <div className="text-[10px] text-neutral-500">Chain ID 98421</div>
                </div>
              </div>
              {isL1 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 uppercase">
                  <Check className="h-3 w-3" /> Active
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isFuji) {
                  switchChain({ chainId: 43113 });
                }
                setNetworkDropdownOpen(false);
              }}
              className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${
                isFuji
                  ? "bg-white/10 text-white font-semibold"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                <div>
                  <div className="text-white font-medium">Fuji C-Chain</div>
                  <div className="text-[10px] text-neutral-500">Chain ID 43113</div>
                </div>
              </div>
              {isFuji && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase">
                  <Check className="h-3 w-3" /> Active
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      <Link
        href={isL1 ? "/compliance" : address ? `https://testnet.snowscan.xyz/address/${address}` : "#"}
        target={isL1 ? undefined : "_blank"}
        rel={isL1 ? undefined : "noopener noreferrer"}
        className="flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3 text-[11px] mono-numbers text-neutral-100 transition hover:border-white/30 hover:bg-white/[0.06]"
        title={isL1 ? "Inspect Compliance & Allowlist Role on Nyxor L1" : "View address on Snowscan testnet explorer"}
      >
        <span className="signal-dot" />
        {shortenAddress(address)}
        <ArrowUpRight className="h-3 w-3 text-neutral-400" />
      </Link>
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
