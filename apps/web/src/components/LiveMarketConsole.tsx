"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { Database, Sparkles, Layers } from "lucide-react";
import {
  getAddressesForInstance,
  type DeploymentInstance,
  MARKET_CLOCK_ABI,
  MARKET_SCHEDULE_ABI,
  PRICE_FEED_ABI,
  RISK_POLICY_ABI,
  LIQUIDITY_VAULT_ABI,
  PERP_MARKET_ABI,
  ERC20_ABI,
} from "../config/contracts";
import { PhaseHero } from "./PhaseHero";
import { ComparisonPanel } from "./ComparisonPanel";
import { TradingPanel } from "./TradingPanel";
import { AdminConsole } from "./AdminConsole";

type ConsoleView = "risk" | "trade" | "demo";

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

export function LiveMarketConsole({ view }: { view: ConsoleView }) {
  const { address, chainId } = useAccount();
  const [selectedMarket, setSelectedMarket] = useState<"guarded" | "standard">("guarded");
  const [deploymentInstance, setDeploymentInstance] = useState<DeploymentInstance>(
    chainId === 98421 ? "l1" : "benchmark"
  );

  useEffect(() => {
    if (chainId === 98421) {
      setDeploymentInstance("l1");
    } else if (chainId === 43113) {
      setDeploymentInstance("benchmark");
    }
  }, [chainId]);

  const addresses = getAddressesForInstance(deploymentInstance);

  const { data: coreData, refetch: refetchCore } = useReadContracts({
    contracts: [
      { address: addresses.MarketClock, abi: MARKET_CLOCK_ABI, functionName: "effectiveNow" },
      { address: addresses.MarketClock, abi: MARKET_CLOCK_ABI, functionName: "demoMode" },
      { address: addresses.MockPriceFeedStandard, abi: PRICE_FEED_ABI, functionName: "latestPrice" },
      { address: addresses.MockPriceFeedGuarded, abi: PRICE_FEED_ABI, functionName: "latestPrice" },
      { address: addresses.LiquidityVaultStandard, abi: LIQUIDITY_VAULT_ABI, functionName: "vaultAssets" },
      { address: addresses.LiquidityVaultStandard, abi: LIQUIDITY_VAULT_ABI, functionName: "insuranceFund" },
      { address: addresses.LiquidityVaultStandard, abi: LIQUIDITY_VAULT_ABI, functionName: "badDebtTotal" },
      { address: addresses.LiquidityVaultGuarded, abi: LIQUIDITY_VAULT_ABI, functionName: "vaultAssets" },
      { address: addresses.LiquidityVaultGuarded, abi: LIQUIDITY_VAULT_ABI, functionName: "insuranceFund" },
      { address: addresses.LiquidityVaultGuarded, abi: LIQUIDITY_VAULT_ABI, functionName: "badDebtTotal" },
      { address: addresses.PerpMarketStandard, abi: PERP_MARKET_ABI, functionName: "totalOiLongUsd" },
      { address: addresses.PerpMarketStandard, abi: PERP_MARKET_ABI, functionName: "totalOiShortUsd" },
      { address: addresses.PerpMarketGuarded, abi: PERP_MARKET_ABI, functionName: "totalOiLongUsd" },
      { address: addresses.PerpMarketGuarded, abi: PERP_MARKET_ABI, functionName: "totalOiShortUsd" },
    ],
    query: { refetchInterval: 12000 },
  });

  const effectiveNow = coreData?.[0]?.result as bigint | undefined;
  const demoMode = coreData?.[1]?.result as boolean | undefined;
  const standardPriceData = coreData?.[2]?.result as [bigint, bigint] | undefined;
  const guardedPriceData = coreData?.[3]?.result as [bigint, bigint] | undefined;
  const tsForPolicy = effectiveNow || BigInt(Math.floor(Date.now() / 1000));

  const { data: scheduleData, refetch: refetchSchedule } = useReadContracts({
    contracts: [
      { address: addresses.MarketSchedule, abi: MARKET_SCHEDULE_ABI, functionName: "phaseAt", args: [tsForPolicy] },
      { address: addresses.MarketHoursRiskPolicy, abi: RISK_POLICY_ABI, functionName: "getParams", args: [tsForPolicy] },
      { address: addresses.FlatRiskPolicy, abi: RISK_POLICY_ABI, functionName: "getParams", args: [tsForPolicy] },
    ],
    query: { refetchInterval: 12000 },
  });

  const phaseResult = scheduleData?.[0]?.result as [number, bigint, bigint] | undefined;
  const guardedParams = scheduleData?.[1]?.result as any;
  const standardParams = scheduleData?.[2]?.result as any;
  const currentPhase = phaseResult?.[0] ?? 0;
  const secondsToClose = phaseResult?.[1];
  const secondsSinceOpen = phaseResult?.[2];
  const currentMarketAddress = selectedMarket === "guarded" ? addresses.PerpMarketGuarded : addresses.PerpMarketStandard;

  const { data: userData, refetch: refetchUser } = useReadContracts({
    contracts: address
      ? [
          { address: addresses.DemoUSDC, abi: ERC20_ABI, functionName: "balanceOf", args: [address] },
          { address: addresses.DemoUSDC, abi: ERC20_ABI, functionName: "allowance", args: [address, currentMarketAddress] },
          { address: currentMarketAddress, abi: PERP_MARKET_ABI, functionName: "getPosition", args: [address] },
          { address: currentMarketAddress, abi: PERP_MARKET_ABI, functionName: "getEquity", args: [address] },
          { address: currentMarketAddress, abi: PERP_MARKET_ABI, functionName: "getLeverage", args: [address] },
          { address: currentMarketAddress, abi: PERP_MARKET_ABI, functionName: "getLiquidationPrice", args: [address] },
        ]
      : [],
    query: { enabled: !!address, refetchInterval: 12000 },
  });

  const rawPosition = userData?.[2]?.result as any;
  const positionEquity = userData?.[3]?.result as bigint | undefined;
  const positionLeverage = userData?.[4]?.result as bigint | number | undefined;
  const positionLiqPrice = userData?.[5]?.result as bigint | undefined;
  const userPosition: PositionData | null = rawPosition?.active
    ? {
        active: rawPosition.active as boolean,
        isLong: rawPosition.isLong as boolean,
        sizeUsd: rawPosition.sizeUsd as bigint,
        collateral: rawPosition.collateral as bigint,
        entryPrice: rawPosition.entryPrice as bigint,
        equity: positionEquity || 0n,
        leverage: positionLeverage || 0,
        liquidationPrice: positionLiqPrice || 0n,
      }
    : null;

  const handleRefreshAll = () => {
    refetchCore();
    refetchSchedule();
    refetchUser();
  };

  const selectedPrice = selectedMarket === "guarded" ? guardedPriceData?.[0] : standardPriceData?.[0];
  const selectedMaxLev = selectedMarket === "guarded" ? guardedParams?.maxLeverageX100 : standardParams?.maxLeverageX100;
  const selectedReduceOnly = selectedMarket === "guarded" ? guardedParams?.reduceOnly : standardParams?.reduceOnly;
  const isAdmin = !!address && address.toLowerCase() === addresses.Deployer.toLowerCase();

  return (
    <div className="space-y-8">
      <div className="nyxor-card flex flex-col items-start justify-between gap-4 rounded-[1.35rem] p-3.5 text-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-neutral-300">
          <Database className="h-4 w-4 text-[#d8ff3f]" />
          <span className="eyebrow">Deployment target</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDeploymentInstance("benchmark")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 mono-numbers transition-all ${deploymentInstance === "benchmark" ? "border-white bg-white font-bold text-black" : "border-white/10 bg-white/[0.03] text-neutral-500 hover:border-white/30 hover:text-white"}`}
          >
            Frozen benchmark <span className="hidden md:inline">/ recorded scenario</span>
          </button>
          <button
            onClick={() => setDeploymentInstance("demo")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 mono-numbers transition-all ${deploymentInstance === "demo" ? "border-[#d8ff3f] bg-[#d8ff3f] font-bold text-black" : "border-white/10 bg-white/[0.03] text-neutral-500 hover:border-white/30 hover:text-white"}`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Fresh demo
          </button>
          <button
            onClick={() => setDeploymentInstance("l1")}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-2 mono-numbers transition-all ${deploymentInstance === "l1" ? "border-violet-400 bg-violet-400 font-bold text-black" : "border-white/10 bg-white/[0.03] text-neutral-500 hover:border-white/30 hover:text-white"}`}
          >
            <Layers className="h-3.5 w-3.5" /> Nyxor L1 (98421)
          </button>
        </div>
      </div>

      <PhaseHero
        phase={currentPhase}
        secondsToClose={secondsToClose}
        secondsSinceOpen={secondsSinceOpen}
        effectiveNow={effectiveNow}
        guardedMaxLev={guardedParams?.maxLeverageX100}
        guardedReduceOnly={guardedParams?.reduceOnly}
        demoMode={demoMode}
      />

      {(view === "risk" || view === "demo") && (
        <ComparisonPanel
          phase={currentPhase}
          standard={{
            vaultAssets: coreData?.[4]?.result as bigint | undefined,
            insuranceFund: coreData?.[5]?.result as bigint | undefined,
            badDebtTotal: coreData?.[6]?.result as bigint | undefined,
            totalOiLong: coreData?.[10]?.result as bigint | undefined,
            totalOiShort: coreData?.[11]?.result as bigint | undefined,
            price: standardPriceData?.[0],
            maxLeverage: standardParams?.maxLeverageX100 || 2000,
            reduceOnly: standardParams?.reduceOnly || false,
          }}
          guarded={{
            vaultAssets: coreData?.[7]?.result as bigint | undefined,
            insuranceFund: coreData?.[8]?.result as bigint | undefined,
            badDebtTotal: coreData?.[9]?.result as bigint | undefined,
            totalOiLong: coreData?.[12]?.result as bigint | undefined,
            totalOiShort: coreData?.[13]?.result as bigint | undefined,
            price: guardedPriceData?.[0],
            maxLeverage: guardedParams?.maxLeverageX100 || 500,
            reduceOnly: guardedParams?.reduceOnly || false,
          }}
        />
      )}

      {view === "trade" && (
        <TradingPanel
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
          markPrice={selectedPrice}
          maxLeverage={selectedMaxLev}
          reduceOnly={selectedReduceOnly}
          usdcBalance={userData?.[0]?.result as bigint | undefined}
          usdcAllowance={userData?.[1]?.result as bigint | undefined}
          userPosition={userPosition}
          onRefresh={handleRefreshAll}
          addresses={addresses}
        />
      )}

      {view === "demo" && <AdminConsole isAdmin={isAdmin} onRefresh={handleRefreshAll} addresses={addresses} />}
    </div>
  );
}
