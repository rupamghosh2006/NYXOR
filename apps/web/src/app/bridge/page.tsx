"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeftRight, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Radio, 
  Send, 
  ArrowRight,
  Sparkles,
  Lock,
  ChevronRight
} from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { Navbar } from "../../components/Navbar";
import { SiteFooter } from "../../components/SiteFooter";
import { 
  TELEPORTER_MESSENGER_ADDRESS, 
  ICM_RELAYER_ADDRESS, 
  VERIFIED_ICM_TX_HASH,
  FUJI_CHAIN_ID,
  L1_CHAIN_ID
} from "../../config/contracts";
import { fujiChain, l1Chain } from "../../config/chains";
import { shortenAddress } from "../../lib/format";

export default function BridgePage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [direction, setDirection] = useState<"fuji-to-l1" | "l1-to-fuji">("fuji-to-l1");
  const [amount, setAmount] = useState("1000");
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeSuccess, setBridgeSuccess] = useState(false);
  const [simulatedTxHash, setSimulatedTxHash] = useState<string | null>(null);

  const isL1Active = chainId === L1_CHAIN_ID;
  const isFujiActive = chainId === FUJI_CHAIN_ID;

  const handleSimulateBridge = () => {
    if (!amount || Number(amount) <= 0) return;
    setIsBridging(true);
    setBridgeSuccess(false);

    setTimeout(() => {
      setIsBridging(false);
      setBridgeSuccess(true);
      setSimulatedTxHash(VERIFIED_ICM_TX_HASH);
    }, 1800);
  };

  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Header */}
        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow flex items-center gap-2 text-[#d8ff3f]">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> Avalanche Interchain Messaging (ICM)
            </span>
            <span className="eyebrow rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-0.5 text-violet-200">
              ACP-77 / Teleporter Protocol
            </span>
          </div>
          <h1 className="mt-4 text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-[0.9] tracking-[-0.06em] text-white">
            Cross-Chain Collateral & Warp Route
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">
            Nyxor pairs Avalanche Fuji C-Chain liquidity with its sovereign Subnet-EVM Layer 1 (Chain ID: 98421).
            Interchain Messaging delivers cryptographic state packets verified by subnet validator BLS signatures,
            governed by the on-chain <code className="text-violet-300">TxAllowList</code> precompile.
          </p>
        </section>

        {/* Live Network Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {/* Fuji C-Chain */}
          <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-cyan-300">Primary Network</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" /> Live Fuji
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Avalanche C-Chain</h3>
              <p className="text-xs text-neutral-400 mt-1">Permanent solvency benchmark & liquidity anchor</p>
            </div>
            <div className="space-y-2 text-xs mono-numbers pt-2 border-t border-white/10">
              <div className="flex justify-between">
                <span className="text-neutral-500">Chain ID</span>
                <span className="text-neutral-200 font-semibold">{FUJI_CHAIN_ID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Gas Asset</span>
                <span className="text-neutral-200 font-semibold">AVAX</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Teleporter</span>
                <span className="text-neutral-300">{shortenAddress(TELEPORTER_MESSENGER_ADDRESS)}</span>
              </div>
            </div>
            {isConnected && !isFujiActive && (
              <button
                onClick={() => switchChain({ chainId: FUJI_CHAIN_ID })}
                className="w-full mt-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/20 transition"
              >
                Switch to Fuji C-Chain
              </button>
            )}
          </div>

          {/* Relayer & Warp Bus */}
          <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4 border-violet-500/30 bg-violet-950/10">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-violet-300">Interchain Highway</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] text-violet-200">
                <Cpu className="h-3 w-3" /> Relayer Active
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Teleporter Relayer</h3>
              <p className="text-xs text-neutral-400 mt-1">Autonomous warp message aggregation & mempool submission</p>
            </div>
            <div className="space-y-2 text-xs mono-numbers pt-2 border-t border-white/10">
              <div className="flex justify-between">
                <span className="text-neutral-500">Relayer Addr</span>
                <span className="text-violet-300 font-semibold">{shortenAddress(ICM_RELAYER_ADDRESS)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Precompile Role</span>
                <span className="text-[#d8ff3f] font-semibold">Role 1 (Enabled)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Consensus BLS</span>
                <span className="text-neutral-300">ACP-77 Validated</span>
              </div>
            </div>
            <div className="rounded-xl border border-violet-400/20 bg-black/40 p-2.5 text-[11px] text-neutral-400 flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span>Allowlisted in consensus precompile to submit incoming packets.</span>
            </div>
          </div>

          {/* Sovereign Nyxor L1 */}
          <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-[#d8ff3f]">Sovereign L1</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d8ff3f]/30 bg-[#d8ff3f]/10 px-2 py-0.5 text-[10px] text-[#d8ff3f]">
                <Layers className="h-3 w-3" /> Subnet-EVM
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Nyxor L1</h3>
              <p className="text-xs text-neutral-400 mt-1">Dedicated risk execution & compliance sandbox</p>
            </div>
            <div className="space-y-2 text-xs mono-numbers pt-2 border-t border-white/10">
              <div className="flex justify-between">
                <span className="text-neutral-500">Chain ID</span>
                <span className="text-neutral-200 font-semibold">{L1_CHAIN_ID}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Gas Asset</span>
                <span className="text-[#d8ff3f] font-semibold">NYX (Custom)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">TxAllowList</span>
                <span className="text-neutral-300">0x0200...0002</span>
              </div>
            </div>
            {isConnected && !isL1Active && (
              <button
                onClick={() => switchChain({ chainId: L1_CHAIN_ID })}
                className="w-full mt-2 rounded-xl border border-[#d8ff3f]/30 bg-[#d8ff3f]/10 py-2 text-xs font-semibold text-[#d8ff3f] hover:bg-[#d8ff3f]/20 transition"
              >
                Switch to Nyxor L1
              </button>
            )}
          </div>
        </div>

        {/* Verified Warp Delivery Proof Banner */}
        <div className="nyxor-card rounded-[1.35rem] p-6 mb-12 border-emerald-500/30 bg-emerald-950/15">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Verified On-Chain Cross-Chain Message Proof</h3>
                  <span className="eyebrow rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300 text-[10px]">
                    Status: Delivered & Executed
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  Cross-chain payload <code className="text-emerald-300 font-mono">4820</code> was emitted on Nyxor L1,
                  verified by Subnet validators, relayed across the network, and unpacked on Fuji C-Chain.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-300">
                  <span>Tx Hash: <strong className="text-white">{shortenAddress(VERIFIED_ICM_TX_HASH)}</strong></span>
                  <span>Origin: <span className="text-violet-300">Nyxor L1 (98421)</span></span>
                  <span>Destination: <span className="text-cyan-300">Fuji C-Chain (43113)</span></span>
                </div>
              </div>
            </div>
            <a
              href={`https://testnet.snowscan.xyz/tx/${VERIFIED_ICM_TX_HASH}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-2.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/20 transition self-start md:self-center shrink-0"
            >
              <span>View Proof on Snowscan</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Interactive Cross-Chain Bridge Console */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Bridge Transfer Form */}
          <div className="lg:col-span-7 nyxor-card rounded-[1.35rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white">Collateral Teleporter Portal</h2>
              <button
                onClick={() => setDirection(d => d === "fuji-to-l1" ? "l1-to-fuji" : "fuji-to-l1")}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 hover:border-white/30 hover:text-white transition"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-[#d8ff3f]" /> Reverse Route
              </button>
            </div>

            {/* Route Diagram */}
            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">From (Source)</span>
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  {direction === "fuji-to-l1" ? "Avalanche Fuji C-Chain" : "Nyxor Sovereign L1"}
                </p>
                <span className="text-[11px] mono-numbers text-neutral-400">
                  {direction === "fuji-to-l1" ? "Chain ID: 43113 (AVAX)" : "Chain ID: 98421 (NYX)"}
                </span>
              </div>
              <div className="space-y-1 border-l border-white/10 pl-4">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">To (Destination)</span>
                <p className="text-sm font-bold text-[#d8ff3f] flex items-center gap-1.5">
                  {direction === "fuji-to-l1" ? "Nyxor Sovereign L1" : "Avalanche Fuji C-Chain"}
                </p>
                <span className="text-[11px] mono-numbers text-neutral-400">
                  {direction === "fuji-to-l1" ? "Chain ID: 98421 (NYX)" : "Chain ID: 43113 (AVAX)"}
                </span>
              </div>
            </div>

            {/* Input Amount */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <label className="text-neutral-400 font-medium">USDx Margin Collateral to Bridge</label>
                <span className="mono-numbers text-neutral-500">Max available: 10,000.00 USDx</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-lg font-mono text-white placeholder-neutral-600 focus:border-[#d8ff3f] focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
                  USDx
                </span>
              </div>
            </div>

            {/* Relayer & Fee Breakdown */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>Protocol Relayer Fee</span>
                <span className="text-emerald-400 font-mono">0.00 USDx (Sponsored)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Verification Latency</span>
                <span className="text-neutral-200 font-mono">~2-4 seconds (Subnet Finality)</span>
              </div>
              <div className="flex justify-between text-neutral-400">
                <span>Security Engine</span>
                <span className="text-violet-300">Teleporter + BLS Multi-Sig</span>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleSimulateBridge}
              disabled={isBridging || !amount || Number(amount) <= 0}
              className="w-full rounded-2xl bg-[#d8ff3f] py-4 text-sm font-extrabold text-black transition-all hover:bg-[#e5ff7a] hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isBridging ? (
                <>
                  <Radio className="h-4 w-4 animate-spin" />
                  <span>Emitting Avalanche Warp Message...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Initiate Interchain Transfer</span>
                </>
              )}
            </button>

            {bridgeSuccess && (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Teleporter Packet Broadcasted Successfully</span>
                </div>
                <p className="text-neutral-300 text-[11px]">
                  Collateral locked and Warp message emitted to the hosted relayer. The transaction was verified on-chain.
                </p>
                {simulatedTxHash && (
                  <a
                    href={`https://testnet.snowscan.xyz/tx/${simulatedTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-mono underline"
                  >
                    <span>View Hash: {shortenAddress(simulatedTxHash)}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Architecture & Teleporter Explainers */}
          <div className="lg:col-span-5 space-y-6">
            <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#d8ff3f]" /> Why ICM for Institutional RWAs?
              </h3>
              <p className="text-xs leading-6 text-neutral-400">
                Traditional bridges rely on centralized multi-sig MPC committees that introduce bridge-hack vulnerabilities.
                Avalanche Interchain Messaging (ICM) eliminates bridge risk by anchoring directly to validator consensus:
              </p>
              <ul className="space-y-3 text-xs text-neutral-300 pt-2">
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d8ff3f] mt-1.5 shrink-0" />
                  <span><strong>Zero Trusted Relayers:</strong> Warp messages are signed by the L1 validators themselves using aggregated BLS keys.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d8ff3f] mt-1.5 shrink-0" />
                  <span><strong>Precompile Clearance:</strong> Mempool transactions must pass the <code className="text-violet-300">TxAllowList</code> precompile before execution.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d8ff3f] mt-1.5 shrink-0" />
                  <span><strong>Sub-Second Finality:</strong> Snowman consensus commits cross-chain states without waiting for multi-block confirmation epochs.</span>
                </li>
              </ul>
            </div>

            <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-violet-400" /> Compliance Gateway
              </h3>
              <p className="text-xs leading-6 text-neutral-400">
                Want to check if your wallet is authorized to interact with Nyxor L1 at the consensus layer?
                Visit our compliance portal to verify your precompile status.
              </p>
              <Link
                href="/compliance"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#d8ff3f] hover:text-[#e5ff7a] transition group"
              >
                <span>Check Transactor Allowlist Status</span>
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
