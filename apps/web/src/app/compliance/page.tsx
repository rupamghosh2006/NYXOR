"use client";

import { useState } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Unlock, 
  UserCheck, 
  Layers, 
  ExternalLink, 
  CheckCircle2, 
  Search, 
  AlertTriangle,
  Cpu,
  KeyRound,
  FileCheck2,
  RefreshCw
} from "lucide-react";
import { useAccount, useReadContract, useWriteContract, useSwitchChain } from "wagmi";
import { Navbar } from "../../components/Navbar";
import { SiteFooter } from "../../components/SiteFooter";
import { 
  TX_ALLOW_LIST_ADDRESS, 
  TX_ALLOW_LIST_ABI, 
  ICM_RELAYER_ADDRESS,
  L1_CHAIN_ID 
} from "../../config/contracts";
import { shortenAddress } from "../../lib/format";

export default function CompliancePage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [inspectAddress, setInspectAddress] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [targetRole, setTargetRole] = useState<"1" | "0">("1");
  const [adminStatusMsg, setAdminStatusMsg] = useState<string | null>(null);

  const isL1 = chainId === L1_CHAIN_ID;
  const adminAddress = "0x4AD14e89622A046803988213E4a9846756531086";
  const isUserAdmin = !!address && address.toLowerCase() === adminAddress.toLowerCase();

  // Read current connected wallet's allowlist role
  const { data: userRoleRaw, refetch: refetchUserRole, isLoading: isRoleLoading } = useReadContract({
    address: TX_ALLOW_LIST_ADDRESS,
    abi: TX_ALLOW_LIST_ABI,
    functionName: "readAllowList",
    args: address ? [address] : undefined,
    chainId: L1_CHAIN_ID,
    query: { enabled: !!address },
  });

  // Read inspected address allowlist role
  const queryAddress = (inspectAddress && inspectAddress.startsWith("0x") && inspectAddress.length === 42) 
    ? (inspectAddress as `0x${string}`) 
    : undefined;

  const { data: inspectedRoleRaw, refetch: refetchInspected } = useReadContract({
    address: TX_ALLOW_LIST_ADDRESS,
    abi: TX_ALLOW_LIST_ABI,
    functionName: "readAllowList",
    args: queryAddress ? [queryAddress] : undefined,
    chainId: L1_CHAIN_ID,
    query: { enabled: !!queryAddress },
  });

  const { writeContractAsync, isPending: isTxPending } = useWriteContract();

  const userRole = userRoleRaw !== undefined ? Number(userRoleRaw) : 0;
  const inspectedRole = inspectedRoleRaw !== undefined ? Number(inspectedRoleRaw) : null;

  const getRoleBadge = (role: number | null) => {
    if (role === 2) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-400/10 px-3 py-1 text-xs font-semibold text-violet-200">
          <KeyRound className="h-3.5 w-3.5" /> Role 2: Compliance Admin
        </span>
      );
    }
    if (role === 1) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" /> Role 1: Approved Transactor
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-300">
        <Lock className="h-3.5 w-3.5" /> Role 0: Unauthorized / Restricted
      </span>
    );
  };

  const handleSetRole = async () => {
    if (!targetAddress || !targetAddress.startsWith("0x") || targetAddress.length !== 42) {
      setAdminStatusMsg("Please enter a valid 42-character EVM address.");
      return;
    }
    try {
      setAdminStatusMsg("Submitting transaction to TxAllowList precompile...");
      if (targetRole === "1") {
        await writeContractAsync({
          address: TX_ALLOW_LIST_ADDRESS,
          abi: TX_ALLOW_LIST_ABI,
          functionName: "setEnabled",
          args: [targetAddress as `0x${string}`],
          chainId: L1_CHAIN_ID,
        });
      } else {
        await writeContractAsync({
          address: TX_ALLOW_LIST_ADDRESS,
          abi: TX_ALLOW_LIST_ABI,
          functionName: "setNone",
          args: [targetAddress as `0x${string}`],
          chainId: L1_CHAIN_ID,
        });
      }
      setAdminStatusMsg(`Successfully updated role for ${shortenAddress(targetAddress)}!`);
      refetchUserRole();
      if (queryAddress) refetchInspected();
    } catch (err: any) {
      setAdminStatusMsg(`Transaction failed: ${err?.message || "Unknown error"}`);
    }
  };

  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Header */}
        <section className="mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow flex items-center gap-2 text-violet-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Subnet-EVM Compliance Precompile
            </span>
            <span className="eyebrow rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-0.5 text-violet-200">
              TxAllowList at 0x0200...0002
            </span>
          </div>
          <h1 className="mt-4 text-[clamp(2.5rem,5vw,5rem)] font-extrabold leading-[0.9] tracking-[-0.06em] text-white">
            Permissioned Consensus & Institutional Whitelist
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">
            Nyxor L1 enforces regulatory access controls at the consensus layer using the Avalanche 
            <code className="text-violet-300 font-mono"> TxAllowList</code> stateful precompile. 
            Unauthorized transactions are filtered at the node mempool boundary before consuming gas or executing smart contract code.
          </p>
        </section>

        {/* Connected Wallet Status Card */}
        <div className="nyxor-card rounded-[1.35rem] p-8 mb-10 border-white/10 bg-white/[0.02]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
                Your Connected Institutional Status
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-bold text-white mono-numbers">
                  {isConnected ? shortenAddress(address) : "No wallet connected"}
                </span>
                {isConnected && getRoleBadge(userRole)}
              </div>
              <p className="text-xs text-neutral-400">
                {userRole > 0
                  ? "Your wallet is fully cleared to submit perpetual trades, mint collateral, and execute margin management on Nyxor L1."
                  : "Transactions from restricted addresses revert automatically at the consensus mempool boundary."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {isConnected && !isL1 && (
                <button
                  onClick={() => switchChain({ chainId: L1_CHAIN_ID })}
                  className="rounded-full bg-[#d8ff3f] px-4 py-2.5 text-xs font-extrabold text-black hover:bg-[#e5ff7a] transition"
                >
                  Switch to Nyxor L1 (98421)
                </button>
              )}
              <button
                onClick={() => refetchUserRole()}
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-xs text-neutral-400 hover:border-white/30 hover:text-white transition"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Re-check
              </button>
            </div>
          </div>
        </div>

        {/* Live Grid: Precompile Architecture & Verification */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* Real-time Precompile Inspector */}
          <div className="lg:col-span-7 nyxor-card rounded-[1.35rem] p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Search className="h-5 w-5 text-[#d8ff3f]" /> Precompile Role Inspector
              </h2>
              <span className="text-xs font-mono text-neutral-500">Live L1 Query</span>
            </div>

            <p className="text-xs text-neutral-400">
              Query any address against the native <code className="text-violet-300 font-mono">readAllowList(address)</code> function on the Nyxor L1 node:
            </p>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  value={inspectAddress}
                  onChange={(e) => setInspectAddress(e.target.value)}
                  placeholder="Enter 0x... wallet address"
                  className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3.5 text-xs font-mono text-white placeholder-neutral-600 focus:border-[#d8ff3f] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                <button
                  onClick={() => setInspectAddress(adminAddress)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-neutral-400 hover:text-white"
                >
                  Load Admin Address
                </button>
                <button
                  onClick={() => setInspectAddress(ICM_RELAYER_ADDRESS)}
                  className="rounded-lg border border-white/10 px-2 py-1 text-neutral-400 hover:text-white"
                >
                  Load ICM Relayer
                </button>
                {address && (
                  <button
                    onClick={() => setInspectAddress(address)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-neutral-400 hover:text-white"
                  >
                    Load My Wallet
                  </button>
                )}
              </div>
            </div>

            {queryAddress && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-400">Target Address:</span>
                  <span className="text-xs font-mono text-white">{shortenAddress(queryAddress)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-xs text-neutral-400">On-Chain Clearance:</span>
                  <div>{getRoleBadge(inspectedRole)}</div>
                </div>
                <div className="text-[11px] text-neutral-500 pt-1">
                  {inspectedRole === 2 && "Permanent consensus administrator seeded at genesis block timestamp 0."}
                  {inspectedRole === 1 && "Allowlisted entity cleared to broadcast transactions to the subnet mempool."}
                  {inspectedRole === 0 && "Restricted. If this address attempts a broadcast, the subnet node drops it immediately."}
                </div>
              </div>
            )}

            {/* Admin Management Widget */}
            <div className="pt-6 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-violet-400" /> Admin Role Manager
                </h3>
                {isUserAdmin ? (
                  <span className="text-[10px] font-bold text-violet-300 uppercase">You are Admin</span>
                ) : (
                  <span className="text-[10px] text-neutral-500">Requires Role 2 (Admin)</span>
                )}
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={targetAddress}
                  onChange={(e) => setTargetAddress(e.target.value)}
                  placeholder="Target address (0x...)"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs font-mono text-white placeholder-neutral-600 focus:border-violet-400 focus:outline-none"
                />

                <div className="flex items-center gap-4 text-xs text-neutral-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="1"
                      checked={targetRole === "1"}
                      onChange={() => setTargetRole("1")}
                      className="accent-[#d8ff3f]"
                    />
                    <span>Role 1: Enable (Allowlist)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="role"
                      value="0"
                      checked={targetRole === "0"}
                      onChange={() => setTargetRole("0")}
                      className="accent-[#d8ff3f]"
                    />
                    <span>Role 0: Revoke (Restricted)</span>
                  </label>
                </div>

                <button
                  onClick={handleSetRole}
                  disabled={isTxPending}
                  className="w-full rounded-xl border border-violet-400/40 bg-violet-400/10 py-2.5 text-xs font-bold text-violet-200 hover:bg-violet-400/20 transition disabled:opacity-50"
                >
                  {isTxPending ? "Broadcasting to Precompile..." : "Submit Role Update to 0x0200...0002"}
                </button>

                {adminStatusMsg && (
                  <p className="text-xs text-neutral-300 font-mono pt-1">{adminStatusMsg}</p>
                )}
              </div>
            </div>
          </div>

          {/* Institutional Compliance Architecture Explainers */}
          <div className="lg:col-span-5 space-y-6">
            <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-[#d8ff3f]" /> Why Consensus Precompiles?
              </h3>
              <p className="text-xs leading-6 text-neutral-400">
                Traditional EVM applications enforce KYC inside Solidity smart contracts (`require(isKyc[msg.sender])`).
                This has two major security flaws:
              </p>
              <div className="space-y-3 text-xs text-neutral-300 pt-2">
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
                  <span className="font-bold text-rose-300">Flaw 1: Gas is Still Wasted on Reverts</span>
                  <p className="text-[11px] text-neutral-400">
                    Smart contract reverts must still be included in blocks, consuming block space and charging gas to failed transactions.
                  </p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
                  <span className="font-bold text-rose-300">Flaw 2: Mempool Denial-of-Service</span>
                  <p className="text-[11px] text-neutral-400">
                    Non-allowlisted bots can flood the node mempool with spam transactions, crowding out institutional orders during market hours close.
                  </p>
                </div>
              </div>
            </div>

            <div className="nyxor-card rounded-[1.35rem] p-6 space-y-4 border-violet-500/30 bg-violet-950/15">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="h-5 w-5 text-violet-400" /> The Subnet-EVM Solution
              </h3>
              <p className="text-xs leading-6 text-neutral-400">
                With Avalanche <code className="text-violet-300 font-mono">TxAllowList</code>, the check happens in the Golang consensus client before the transaction ever reaches the EVM.
              </p>
              <ul className="space-y-2 text-xs text-neutral-300 pt-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#d8ff3f] shrink-0" />
                  <span><strong>Zero Gas Spent:</strong> Rejected transactions never hit the blockchain.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#d8ff3f] shrink-0" />
                  <span><strong>Mempool Gated:</strong> Nodes refuse to gossip unapproved signatures.</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#d8ff3f] shrink-0" />
                  <span><strong>Institutional Grade:</strong> Satisfies regulatory isolation requirements.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
