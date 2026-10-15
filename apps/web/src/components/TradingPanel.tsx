"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Droplets,
  AlertCircle,
  Check,
  Loader2,
  ShieldCheck,
  X,
  FileText,
} from "lucide-react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, maxUint256 } from "viem";
import { CONTRACT_ADDRESSES, PERP_MARKET_ABI, ERC20_ABI } from "../config/contracts";
import { formatUsdx, formatPrice, formatLeverage } from "../lib/format";
import { TxReceiptModal } from "./TxReceiptModal";

interface PositionData {
  active: boolean;
  isLong: boolean;
  sizeUsd: bigint;
  collateral: bigint;
  entryPrice: bigint;
  equity: bigint;
  leverage: bigint | number;
  liquidationPrice: bigint;
}

interface TradingPanelProps {
  selectedMarket: "guarded" | "standard";
  onSelectMarket: (market: "guarded" | "standard") => void;
  markPrice: bigint | undefined;
  maxLeverage: bigint | number | undefined;
  reduceOnly: boolean | undefined;
  usdcBalance: bigint | undefined;
  usdcAllowance: bigint | undefined;
  userPosition: PositionData | null;
  onRefresh: () => void;
  addresses?: Record<string, `0x${string}`>;
}

export function TradingPanel({
  selectedMarket,
  onSelectMarket,
  markPrice,
  maxLeverage = 2000,
  reduceOnly = false,
  usdcBalance = 0n,
  usdcAllowance = 0n,
  userPosition,
  onRefresh,
  addresses,
}: TradingPanelProps) {
  const { address, isConnected, chainId } = useAccount();
  const [isLong, setIsLong] = useState(true);
  const [marginInput, setMarginInput] = useState("500");
  const [leverageInput, setLeverageInput] = useState("10");
  const [addMarginInput, setAddMarginInput] = useState("100");

  const { writeContractAsync } = useWriteContract();
  const [isTxPending, setIsTxPending] = useState(false);
  const [txMessage, setTxMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptHash, setActiveReceiptHash] = useState<string | null>(null);

  const isL1 = chainId === 98421 || (!chainId && true);

  const handleTxSuccess = (hash: string, successMessage: string) => {
    setTxHash(hash);
    setActiveReceiptHash(hash);
    setTxMessage(successMessage);
    setTimeout(() => {
      onRefresh();
    }, 1500);
    setTimeout(() => {
      setTxMessage((prev) => (prev === successMessage ? null : prev));
    }, 30000);
  };

  const resolvedAddresses = addresses || CONTRACT_ADDRESSES;
  const marketAddress =
    selectedMarket === "guarded"
      ? resolvedAddresses.PerpMarketGuarded
      : resolvedAddresses.PerpMarketStandard;

  const maxLevFloat = Number(maxLeverage) / 100;
  const currentLevFloat = Math.min(Number(leverageInput) || 1, maxLevFloat);
  const marginUsd = parseFloat(marginInput) || 0;
  const notionalSize = marginUsd * currentLevFloat;

  // Check if approval is needed
  const marginBigInt = parseUnits(marginInput || "0", 6);
  const needsApproval = usdcAllowance < marginBigInt;

  // Claim Faucet USDx
  const handleFaucet = async () => {
    if (!address) return;
    try {
      setIsTxPending(true);
      setTxMessage("Minting 5,000 test USDx...");
      const hash = await writeContractAsync({
        address: resolvedAddresses.DemoUSDC,
        abi: ERC20_ABI,
        functionName: "faucet",
        args: [address, parseUnits("5000", 6)],
      });
      handleTxSuccess(hash, `Minted 5,000 USDx! Tx: ${hash.slice(0, 10)}...`);
    } catch (err: any) {
      setTxMessage(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Approve USDx
  const handleApprove = async () => {
    try {
      setIsTxPending(true);
      setTxMessage("Approving USDx collateral...");
      const hash = await writeContractAsync({
        address: resolvedAddresses.DemoUSDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [marketAddress, maxUint256],
      });
      handleTxSuccess(hash, `Approved USDx Collateral! Tx: ${hash.slice(0, 10)}...`);
    } catch (err: any) {
      setTxMessage(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Open Position
  const handleOpenPosition = async () => {
    if (reduceOnly) {
      alert("Market is in reduce-only mode. New risk cannot be opened.");
      return;
    }
    try {
      setIsTxPending(true);
      setTxMessage("Opening perpetual position...");
      const levX100 = Math.round(currentLevFloat * 100);
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: PERP_MARKET_ABI,
        functionName: "openPosition",
        args: [isLong, marginBigInt, levX100],
      });
      handleTxSuccess(hash, `Position Opened! Tx: ${hash.slice(0, 10)}...`);
    } catch (err: any) {
      setTxMessage(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Close Position
  const handleClosePosition = async () => {
    try {
      setIsTxPending(true);
      setTxMessage("Closing perpetual position...");
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: PERP_MARKET_ABI,
        functionName: "closePosition",
      });
      handleTxSuccess(hash, `Position Closed! Tx: ${hash.slice(0, 10)}...`);
    } catch (err: any) {
      setTxMessage(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  // Add Margin
  const handleAddMargin = async () => {
    try {
      setIsTxPending(true);
      const addBigInt = parseUnits(addMarginInput || "0", 6);
      setTxMessage("Adding collateral...");
      const hash = await writeContractAsync({
        address: marketAddress,
        abi: PERP_MARKET_ABI,
        functionName: "addMargin",
        args: [addBigInt],
      });
      handleTxSuccess(hash, `Margin Added! Tx: ${hash.slice(0, 10)}...`);
    } catch (err: any) {
      setTxMessage(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setIsTxPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Prominent Transaction Notification & Receipt Banner */}
      {txMessage && (
        <div
          className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono shadow-xl transition-all ${
            txMessage.startsWith("Error")
              ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
              : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                txMessage.startsWith("Error")
                  ? "bg-rose-400"
                  : "bg-emerald-400 animate-pulse"
              }`}
            />
            <span className="font-sans font-medium text-white">{txMessage}</span>
          </div>

          <div className="flex items-center gap-2">
            {txHash && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReceiptHash(txHash);
                    setIsReceiptModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-violet-200 hover:text-white font-sans text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-violet-400" />
                  <span>{isL1 ? "View L1 On-Chain Receipt" : "Inspect Receipt"}</span>
                </button>

                {!isL1 && (
                  <a
                    href={`https://testnet.snowscan.xyz/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-sans text-xs font-semibold inline-flex items-center gap-1.5 transition"
                  >
                    <span>View on Snowscan</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-neutral-400" />
                  </a>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setTxMessage(null);
                setTxHash(null);
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"
              title="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Trading Form */}
      <div className="nyxor-card lg:col-span-6 rounded-[1.5rem] p-6 transition-colors">
        {/* Market Selector Tabs */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex gap-2">
            <button
              onClick={() => onSelectMarket("guarded")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                selectedMarket === "guarded"
                  ? "bg-white text-black shadow-lg shadow-white/10"
                  : "bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              Guarded Market (Nyxor)
            </button>
            <button
              onClick={() => onSelectMarket("standard")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                selectedMarket === "standard"
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-950/30"
                  : "bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              Standard (Naive 20x)
            </button>
          </div>

          {/* Testnet Faucet */}
          {isConnected && (
            <button
              onClick={handleFaucet}
              disabled={isTxPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#d8ff3f]/25 bg-[#d8ff3f]/10 text-[#d8ff3f] hover:bg-[#d8ff3f]/15 text-xs mono-numbers transition-all"
            >
              <Droplets className="h-3.5 w-3.5" />
              <span>Claim USDx</span>
            </button>
          )}
        </div>

        {/* Long / Short Switch */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => setIsLong(true)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isLong
                ? "bg-emerald-400 text-black shadow-lg shadow-emerald-400/10"
                : "bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>LONG</span>
          </button>
          <button
            onClick={() => setIsLong(false)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              !isLong
                ? "bg-rose-500 text-white shadow-lg shadow-rose-950/30"
                : "bg-white/[0.04] text-neutral-500 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>SHORT</span>
          </button>
        </div>

        {/* Collateral Input */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Collateral Margin</span>
            <span className="font-mono">
              Balance: {formatUsdx(usdcBalance)}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={marginInput}
              onChange={(e) => setMarginInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-slate-100 mono-numbers text-sm focus:border-[#d8ff3f] focus:outline-none"
              placeholder="500"
            />
            <span className="absolute right-4 top-2.5 text-xs font-mono text-slate-400">
              USDx
            </span>
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span>Leverage Multiplier</span>
            <span className="font-mono text-violet-400 font-bold">
              {currentLevFloat.toFixed(2)}x / Max {maxLevFloat.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="1"
            max={maxLevFloat}
            step="0.5"
            value={currentLevFloat}
            onChange={(e) => setLeverageInput(e.target.value)}
            className="w-full h-2 appearance-none cursor-pointer rounded-lg bg-white/10 accent-[#d8ff3f]"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
            <span>1x</span>
            <span>5x (Weekend Cap)</span>
            <span>10x</span>
            <span>{maxLevFloat.toFixed(1)}x Max</span>
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-3.5 text-xs mono-numbers space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Position Notional</span>
            <span className="text-slate-100 font-semibold">{notionalSize.toFixed(2)} USDx</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Oracle Reference</span>
            <span className="text-slate-100">{formatPrice(markPrice)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Opening Fee (6 bps)</span>
            <span className="text-slate-100">{(notionalSize * 0.0006).toFixed(3)} USDx</span>
          </div>
          {reduceOnly && (
            <div className="pt-2 text-rose-400 font-sans text-xs flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Market in Reduce-Only mode. New risk opening disabled.</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-5">
          {!isConnected ? (
            <div className="text-center py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono">
              Connect wallet to trade on Avalanche Fuji C-Chain
            </div>
          ) : needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isTxPending}
              className="w-full py-3 rounded-xl bg-[#d8ff3f] hover:bg-[#e5ff7a] text-black font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#d8ff3f]/10"
            >
              {isTxPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Approve USDx for {selectedMarket === "guarded" ? "Guarded" : "Standard"} Market</span>
            </button>
          ) : (
            <button
              onClick={handleOpenPosition}
              disabled={isTxPending || reduceOnly}
              className={`w-full py-3 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg ${
                reduceOnly
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                  : isLong
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30"
                  : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/30"
              }`}
            >
              {isTxPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {reduceOnly
                  ? "Reduce-Only Active"
                  : `Open ${isLong ? "Long" : "Short"} ${currentLevFloat.toFixed(1)}x Position`}
              </span>
            </button>
          )}

          {txMessage && (
            <div className="mt-2 text-center text-xs font-mono text-cyan-300 flex items-center justify-center gap-1.5 flex-wrap">
              <span>{txMessage}</span>
              {txHash && (
                isL1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReceiptHash(txHash);
                      setIsReceiptModalOpen(true);
                    }}
                    className="underline text-white hover:text-cyan-200 inline-flex items-center gap-1 ml-1 cursor-pointer font-sans"
                  >
                    View L1 Receipt <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />
                  </button>
                ) : (
                  <a
                    href={`https://testnet.snowscan.xyz/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-white hover:text-cyan-200 inline-flex items-center gap-0.5 ml-1"
                  >
                    View on Snowscan <ArrowUpRight className="h-3 w-3" />
                  </a>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Position Card */}
      <div className="nyxor-card lg:col-span-6 rounded-[1.5rem] p-6 flex flex-col justify-between transition-colors">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span>Your Active Position</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                {selectedMarket}
              </span>
            </h3>

            {userPosition?.active && (
              <span
                className={`text-xs font-bold font-mono px-2.5 py-1 rounded-md ${
                  userPosition.isLong
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                    : "bg-rose-950 text-rose-400 border border-rose-800/60"
                }`}
              >
                {userPosition.isLong ? "LONG" : "SHORT"} {formatLeverage(userPosition.leverage)}
              </span>
            )}
          </div>

          {!userPosition || !userPosition.active ? (
            <div className="py-16 text-center text-slate-400 text-xs font-mono flex flex-col items-center justify-center gap-2">
              <span className="h-10 w-10 rounded-full bg-slate-900/80 flex items-center justify-center text-slate-400">
                Ø
              </span>
              <span>No open position in this market</span>
              <span className="text-slate-400 text-[11px]">
                Submit the form on the left or claim test USDx to open one.
              </span>
            </div>
          ) : (
            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px]">Position Size</span>
                  <div className="text-slate-100 font-bold mt-0.5">
                    {formatUsdx(userPosition.sizeUsd)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px]">Margin Collateral</span>
                  <div className="text-slate-100 font-bold mt-0.5">
                    {formatUsdx(userPosition.collateral)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px]">Entry Price</span>
                  <div className="text-slate-100 font-bold mt-0.5">
                    {formatPrice(userPosition.entryPrice)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px]">Liquidation Price</span>
                  <div className="text-rose-400 font-bold mt-0.5">
                    {formatPrice(userPosition.liquidationPrice)}
                  </div>
                </div>
              </div>

              {/* Equity & PnL */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Current Position Equity</span>
                  <span className="font-bold text-slate-100">{formatUsdx(userPosition.equity)}</span>
                </div>
                <div className="flex justify-between items-center text-xs mt-1.5 pt-1.5 border-t border-slate-800/60">
                  <span className="text-slate-400">Unrealized PnL</span>
                  <span
                    className={`font-bold ${
                      userPosition.equity >= userPosition.collateral
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {userPosition.equity >= userPosition.collateral ? "+" : ""}
                    {formatUsdx(userPosition.equity - userPosition.collateral)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Position Actions */}
        {userPosition?.active && (
          <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
            <button
              onClick={handleClosePosition}
              disabled={isTxPending}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-200 border border-slate-700 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2"
            >
              {isTxPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Close Position</span>
            </button>

            <div className="flex gap-2">
              <input
                type="number"
                value={addMarginInput}
                onChange={(e) => setAddMarginInput(e.target.value)}
                className="w-2/3 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-100 font-mono text-xs focus:outline-none"
                placeholder="100"
              />
              <button
                onClick={handleAddMargin}
                disabled={isTxPending}
                className="w-1/3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs font-mono transition-all"
              >
                + Add Margin
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    <TxReceiptModal
      isOpen={isReceiptModalOpen}
      onClose={() => setIsReceiptModalOpen(false)}
      txHash={activeReceiptHash}
      chainId={chainId}
    />
  </div>
);
}
