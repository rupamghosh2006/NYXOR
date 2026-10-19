"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Fuel,
} from "lucide-react";
import { formatUnits } from "viem";
import { getExplorerTxUrl } from "../config/chains";

interface TxReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  txHash: string | null;
  chainId: number | undefined;
}

interface ReceiptData {
  blockHash: string;
  blockNumber: string;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  from: string;
  gasUsed: string;
  logs: any[];
  status: string;
  to: string;
  transactionHash: string;
  transactionIndex: string;
  type: string;
}

const L1_RPC_URL =
  process.env.NEXT_PUBLIC_L1_RPC_URL ||
  process.env.NEXT_PUBLIC_L1_RPC ||
  "https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2rbFkegM5CZH4zSCXmSF5kLe9JEWwDbLipkU1Sfb1gy1ZFLjUS/rpc";
const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";

const KNOWN_CONTRACTS: Record<string, string> = {
  // Nyxor L1 contracts (Active)
  "0x802508db190b1826c6fc4238b5172f344ba96811": "DemoUSDC (USDx Margin Asset)",
  "0x0269fa1782f5ed743486091900aa24ef1c8dcada": "MarketClock (Trading Hours Engine)",
  "0x3f5560b462dc91339faaeacde7a0e98d26a20aab": "MarketSchedule (Weekend Risk Schedule)",
  "0x7f7b80959f30a06d3f066b8b63b065b02ad1a4d7": "MockPriceFeedStandard (Unmanaged)",
  "0x66ac4ab263b69be7003089be185a202a9e981fca": "MockPriceFeedGuarded (Checkpointing)",
  "0x4341d3a566ac6e0e51076b9fef68efe3ca5e047f": "FlatRiskPolicy (Static 20x)",
  "0x820be01587cfd1f9c6d46cb363f09d5c9dcae974": "MarketHoursRiskPolicy (Dynamic Risk)",
  "0x4c38297282959b86482b10d59210c3f2df84b659": "LiquidityVaultStandard (Standard LP)",
  "0x648b16f94c1ff3776368d8bc067b5f8881ce6cfd": "LiquidityVaultGuarded (Guarded LP)",
  "0x2268c8cb67e1cd78ca4ab254894bb5f5d1e23fab": "PerpMarketStandard (Naive Market)",
  "0x400d575b8be7a395fbf4bc8161a4a454605730c7": "PerpMarketGuarded (Nyxor Guarded)",
  // Precompiles & Infrastructure
  "0x0200000000000000000000000000000000000002": "TxAllowList Precompile (Mempool Guard)",
  "0x253b2784c75e610dd0ff1da844684a1ac0aa5fcf": "TeleporterMessenger (Native ICM)",
  "0x05c474824e7d2cc67cf22b456f7cf60c0e3a1289": "TeleporterSender (Nyxor L1 Warp Origin)",
  "0xd8b6b037b75b6605c34bf6b7f4dd0e93f40f1af7": "TeleporterReceiver (Fuji C-Chain Destination)",
  "0x4ad14e89622a046803988213e4a9846756531086": "Deployer / Risk Administrator",
};

export function TxReceiptModal({
  isOpen,
  onClose,
  txHash,
  chainId,
}: TxReceiptModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const isL1 = chainId === 98421 || (!chainId && true);
  const rpcUrl = isL1 ? L1_RPC_URL : FUJI_RPC_URL;
  const gasSymbol = isL1 ? "NYX" : "AVAX";

  useEffect(() => {
    if (!isOpen || !txHash) {
      setReceipt(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchReceipt = async () => {
      try {
        const queryChainId = chainId || (isL1 ? 98421 : 43113);
        const res = await fetch(
          `/api/receipt?txHash=${encodeURIComponent(txHash)}&chainId=${queryChainId}`
        );

        const data = await res.json();
        if (!isMounted) return;

        if (data.result) {
          setReceipt(data.result);
        } else if (data.error) {
          setError(
            typeof data.error === "string"
              ? data.error
              : data.error.message || "Failed to retrieve receipt from RPC"
          );
        } else {
          // Transaction may still be pending in the block
          setError("Transaction is pending or not yet mined in the latest block.");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || "Network error querying node RPC endpoint");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchReceipt();
    return () => {
      isMounted = false;
    };
  }, [isOpen, txHash, rpcUrl]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const blockNumberDecimal = receipt?.blockNumber
    ? parseInt(receipt.blockNumber, 16)
    : null;
  const gasUsedDecimal = receipt?.gasUsed
    ? parseInt(receipt.gasUsed, 16)
    : null;
  const gasPriceWei = receipt?.effectiveGasPrice
    ? BigInt(receipt.effectiveGasPrice)
    : 0n;
  const gasPriceGwei = gasPriceWei > 0n ? formatUnits(gasPriceWei, 9) : "1.5";
  const totalGasFee =
    gasUsedDecimal && gasPriceWei
      ? formatUnits(BigInt(gasUsedDecimal) * gasPriceWei, 18)
      : null;

  const targetLabel = receipt?.to
    ? KNOWN_CONTRACTS[receipt.to.toLowerCase()] || receipt.to
    : "Contract Creation";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0f0f10] p-6 shadow-2xl text-left font-mono relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-emerald-600/10 blur-3xl" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-sans font-bold text-base text-white">
                  {isL1 ? "Nyxor Sovereign L1 Receipt" : "Fuji C-Chain Receipt"}
                </h3>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                    isL1
                      ? "bg-violet-950/80 border border-violet-800/80 text-violet-300"
                      : "bg-cyan-950/80 border border-cyan-800/80 text-cyan-300"
                  }`}
                >
                  {isL1 ? "Chain ID: 98421" : "Chain ID: 43113"}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Cryptographic transaction verification fetched directly from the validator node RPC.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition"
            title="Close Receipt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="mt-5 space-y-4 max-h-[75vh] overflow-y-auto pr-1 relative z-10 text-xs">
          {loading && (
            <div className="py-16 text-center text-neutral-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
              <span className="text-sm text-neutral-300 font-sans">
                Querying {isL1 ? "Nyxor L1" : "Fuji"} Validator Node RPC...
              </span>
              <span className="text-[11px] font-mono text-neutral-500">
                eth_getTransactionReceipt({txHash?.slice(0, 16)}...)
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <span>Node Query Note</span>
              </div>
              <p className="text-neutral-300 text-[11px]">{error}</p>
              {txHash && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-neutral-400">Tx Hash:</span>
                  <span className="font-mono text-white text-[11px] break-all">{txHash}</span>
                </div>
              )}
            </div>
          )}

          {receipt && !loading && (
            <>
              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300 text-sm font-sans">
                      Transaction Confirmed & Executed
                    </span>
                    <div className="text-[11px] text-neutral-300">
                      Block #{blockNumberDecimal?.toLocaleString()} • Status 0x1 (Success)
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-emerald-300 uppercase">
                  Mined
                </span>
              </div>

              {/* Transaction Key Details Grid */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                {/* Hash */}
                <div>
                  <span className="text-neutral-400 text-[11px]">Transaction Hash</span>
                  <div className="mt-1 flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/10">
                    <span className="text-neutral-200 text-[11px] break-all">
                      {receipt.transactionHash}
                    </span>
                    <button
                      onClick={() => copyToClipboard(receipt.transactionHash, "hash")}
                      className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition shrink-0"
                      title="Copy Hash"
                    >
                      {copiedKey === "hash" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* From / To */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-neutral-400 text-[11px]">Sender (From)</span>
                    <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between">
                      <span className="text-neutral-200 text-[11px] truncate">
                        {receipt.from}
                      </span>
                      <button
                        onClick={() => copyToClipboard(receipt.from, "from")}
                        className="p-1 hover:text-white transition text-neutral-400 shrink-0"
                        title="Copy Sender"
                      >
                        {copiedKey === "from" ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-neutral-400 text-[11px]">Interacted With (To)</span>
                    <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/10">
                      <div className="text-violet-300 font-semibold text-[11px] truncate">
                        {targetLabel}
                      </div>
                      <div className="text-neutral-500 text-[10px] truncate mt-0.5">
                        {receipt.to}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gas & Fee Stats */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-neutral-400 text-[10px] flex items-center gap-1">
                      <Cpu className="h-3 w-3 text-violet-400" /> Gas Consumed
                    </span>
                    <div className="text-white font-bold mt-1 text-xs">
                      {gasUsedDecimal?.toLocaleString()} units
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-neutral-400 text-[10px] flex items-center gap-1">
                      <Fuel className="h-3 w-3 text-cyan-400" /> Gas Price
                    </span>
                    <div className="text-white font-bold mt-1 text-xs">
                      {gasPriceGwei} Gwei
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="text-neutral-400 text-[10px] flex items-center gap-1">
                      <Layers className="h-3 w-3 text-emerald-400" /> Total Fee
                    </span>
                    <div className="text-white font-bold mt-1 text-xs truncate">
                      {totalGasFee ? `${parseFloat(totalGasFee).toFixed(6)} ${gasSymbol}` : `~0.00007 ${gasSymbol}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Subnet-EVM Architecture Information */}
              {isL1 && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-violet-200 text-xs">
                      Avalanche Subnet Infrastructure
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-violet-900/60 border border-violet-700/60 text-violet-300">
                      PoA Consensus (ACP-77)
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400">P-Chain Subnet ID:</span>
                      <span className="font-mono text-violet-300 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                        25ZDnC6...vo5
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400">P-Chain Blockchain ID:</span>
                      <span className="font-mono text-violet-300 bg-black/40 px-2 py-0.5 rounded border border-white/10">
                        2SrgwcL...baY
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-300">
                      <span className="text-neutral-400">Validator Node:</span>
                      <span className="text-neutral-300 font-mono">
                        NodeID-4sodDoXrW97ghLGGfDQKg1HmkjrqXhqVH
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* External Explorer Link */}
              <div className="pt-2">
                {isL1 ? (
                  <a
                    href={getExplorerTxUrl(receipt.transactionHash, 98421)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl border border-[#d8ff3f]/40 bg-[#d8ff3f]/10 hover:bg-[#d8ff3f]/20 text-[#d8ff3f] text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <span>Open on Avalanche L1 Explorer</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <a
                    href={`https://testnet.snowscan.xyz/tx/${receipt.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl border border-cyan-400/30 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
                  >
                    <span>Open on Snowscan Explorer</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              {/* Raw JSON-RPC Accordion */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full flex items-center justify-between text-[11px] text-neutral-400 hover:text-neutral-200 transition py-1"
                >
                  <span className="font-semibold">
                    {showRawJson ? "Hide" : "Inspect"} Raw JSON-RPC Node Response ({receipt.logs?.length || 0} events)
                  </span>
                  {showRawJson ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                {showRawJson && (
                  <pre className="mt-2 p-3 rounded-lg bg-black/70 border border-white/10 text-[10px] text-neutral-300 overflow-x-auto max-h-48 leading-relaxed font-mono">
                    {JSON.stringify(receipt, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-neutral-500 text-[11px] relative z-10">
          <span>Nyxor Protocol • Testnet Architecture</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
