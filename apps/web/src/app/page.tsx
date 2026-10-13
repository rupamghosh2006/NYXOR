"use client";

import Image from "next/image";
import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
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
import { Navbar } from "../components/Navbar";
import { Banner } from "../components/Banner";
import { PhaseHero } from "../components/PhaseHero";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { TradingPanel } from "../components/TradingPanel";
import { AdminConsole } from "../components/AdminConsole";
import { RecordedRun } from "../components/RecordedRun";
import { ExternalLink, Github, Sparkles, Database, ArrowUpRight } from "lucide-react";

export default function Home() {
  const { address, isConnected } = useAccount();
  const [selectedMarket, setSelectedMarket] = useState<"guarded" | "standard">("guarded");
  const [deploymentInstance, setDeploymentInstance] = useState<DeploymentInstance>("benchmark");

  const addresses = getAddressesForInstance(deploymentInstance);

  // Read Core System State
  const { data: coreData, refetch: refetchCore } = useReadContracts({
    contracts: [
      // 0: Clock effectiveNow
      {
        address: addresses.MarketClock,
        abi: MARKET_CLOCK_ABI,
        functionName: "effectiveNow",
      },
      // 1: Clock demoMode
      {
        address: addresses.MarketClock,
        abi: MARKET_CLOCK_ABI,
        functionName: "demoMode",
      },
      // 2: Standard Feed latestPrice
      {
        address: addresses.MockPriceFeedStandard,
        abi: PRICE_FEED_ABI,
        functionName: "latestPrice",
      },
      // 3: Guarded Feed latestPrice
      {
        address: addresses.MockPriceFeedGuarded,
        abi: PRICE_FEED_ABI,
        functionName: "latestPrice",
      },
      // 4: Standard Vault Assets
      {
        address: addresses.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      // 5: Standard Vault Insurance Fund
      {
        address: addresses.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      // 6: Standard Vault Bad Debt
      {
        address: addresses.LiquidityVaultStandard,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      // 7: Guarded Vault Assets
      {
        address: addresses.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "vaultAssets",
      },
      // 8: Guarded Vault Insurance Fund
      {
        address: addresses.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "insuranceFund",
      },
      // 9: Guarded Vault Bad Debt
      {
        address: addresses.LiquidityVaultGuarded,
        abi: LIQUIDITY_VAULT_ABI,
        functionName: "badDebtTotal",
      },
      // 10: Standard Market OI Long
      {
        address: addresses.PerpMarketStandard,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
      // 11: Standard Market OI Short
      {
        address: addresses.PerpMarketStandard,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiShortUsd",
      },
      // 12: Guarded Market OI Long
      {
        address: addresses.PerpMarketGuarded,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiLongUsd",
      },
      // 13: Guarded Market OI Short
      {
        address: addresses.PerpMarketGuarded,
        abi: PERP_MARKET_ABI,
        functionName: "totalOiShortUsd",
      },
    ],
    query: {
      refetchInterval: 4000,
    },
  });

  const effectiveNow = coreData?.[0]?.result as bigint | undefined;
  const demoMode = coreData?.[1]?.result as boolean | undefined;
  const standardPriceData = coreData?.[2]?.result as [bigint, bigint] | undefined;
  const guardedPriceData = coreData?.[3]?.result as [bigint, bigint] | undefined;

  // Read Phase & Dynamic Risk Params using current simulated timestamp
  const tsForPolicy = effectiveNow || BigInt(Math.floor(Date.now() / 1000));

  const { data: scheduleData, refetch: refetchSchedule } = useReadContracts({
    contracts: [
      // 0: Schedule phaseAt
      {
        address: addresses.MarketSchedule,
        abi: MARKET_SCHEDULE_ABI,
        functionName: "phaseAt",
        args: [tsForPolicy],
      },
      // 1: Guarded Policy params
      {
        address: addresses.MarketHoursRiskPolicy,
        abi: RISK_POLICY_ABI,
        functionName: "getParams",
        args: [tsForPolicy],
      },
      // 2: Standard Policy params
      {
        address: addresses.FlatRiskPolicy,
        abi: RISK_POLICY_ABI,
        functionName: "getParams",
        args: [tsForPolicy],
      },
    ],
    query: {
      refetchInterval: 4000,
    },
  });

  const phaseResult = scheduleData?.[0]?.result as [number, bigint, bigint] | undefined;
  const guardedParams = scheduleData?.[1]?.result as any;
  const standardParams = scheduleData?.[2]?.result as any;

  const currentPhase = phaseResult ? phaseResult[0] : 0;
  const secondsToClose = phaseResult ? phaseResult[1] : undefined;
  const secondsSinceOpen = phaseResult ? phaseResult[2] : undefined;

  // Read User Specific Data (Balances, Positions)
  const currentMarketAddress =
    selectedMarket === "guarded"
      ? addresses.PerpMarketGuarded
      : addresses.PerpMarketStandard;

  const { data: userData, refetch: refetchUser } = useReadContracts({
    contracts: address
      ? [
          // 0: User USDC balance
          {
            address: addresses.DemoUSDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          },
          // 1: User USDC allowance for selected market
          {
            address: addresses.DemoUSDC,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, currentMarketAddress],
          },
          // 2: User Position
          {
            address: currentMarketAddress,
            abi: PERP_MARKET_ABI,
            functionName: "getPosition",
            args: [address],
          },
          // 3: User Equity
          {
            address: currentMarketAddress,
            abi: PERP_MARKET_ABI,
            functionName: "getEquity",
            args: [address],
          },
          // 4: User Leverage
          {
            address: currentMarketAddress,
            abi: PERP_MARKET_ABI,
            functionName: "getLeverage",
            args: [address],
          },
          // 5: User Liquidation Price
          {
            address: currentMarketAddress,
            abi: PERP_MARKET_ABI,
            functionName: "getLiquidationPrice",
            args: [address],
          },
        ]
      : [],
    query: {
      enabled: !!address,
      refetchInterval: 4000,
    },
  });

  const usdcBalance = userData?.[0]?.result as bigint | undefined;
  const usdcAllowance = userData?.[1]?.result as bigint | undefined;
  const rawPosition = userData?.[2]?.result as any;
  const positionEquity = userData?.[3]?.result as bigint | undefined;
  const positionLeverage = userData?.[4]?.result as bigint | number | undefined;
  const positionLiqPrice = userData?.[5]?.result as bigint | undefined;

  const userPosition =
    rawPosition && rawPosition.active
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

  // Check if connected address is Deployer / Admin
  const isAdmin =
    !!address &&
    address.toLowerCase() === addresses.Deployer.toLowerCase();

  const handleRefreshAll = () => {
    refetchCore();
    refetchSchedule();
    refetchUser();
  };

  const selectedPrice =
    selectedMarket === "guarded"
      ? guardedPriceData?.[0]
      : standardPriceData?.[0];

  const selectedMaxLev =
    selectedMarket === "guarded"
      ? guardedParams?.maxLeverageX100
      : standardParams?.maxLeverageX100;

  const selectedReduceOnly =
    selectedMarket === "guarded"
      ? guardedParams?.reduceOnly
      : standardParams?.reduceOnly;

  return (
    <div id="top" className="nyxor-shell flex flex-col justify-between">
      <div>
        <Navbar />
        <Banner demoMode={demoMode} />

        <div className="overflow-hidden border-y border-white/10 bg-white/[0.025] py-2">
          <div className="ticker-track whitespace-nowrap eyebrow text-neutral-500">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="mr-10 inline-flex items-center gap-3">
                <span className="text-[#d8ff3f]">◆</span>
                NYXOR / MARKET-HOURS RISK ENGINE
                <span className="text-violet-300">—</span>
                PRE-CLOSE DELEVERAGING
                <span className="text-[#d8ff3f]">—</span>
                FUJI TESTNET / SIMULATED ORACLE
              </span>
            ))}
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 space-y-10">
          <section id="protocol" className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="eyebrow flex items-center gap-2 text-[#d8ff3f]">
                <span className="signal-dot" /> LIVE ON FUJI / DEMO ENVIRONMENT
              </div>
              <h1 className="mt-4 max-w-3xl text-[clamp(2.8rem,7vw,6.75rem)] font-extrabold leading-[0.87] tracking-[-0.065em] text-white">
                The market closes.<br />
                <span className="text-neutral-500">Your risk shouldn&apos;t.</span>
              </h1>
            </div>
            <div className="max-w-md lg:justify-self-end lg:pb-1">
              <p className="text-sm leading-6 text-neutral-400">
                Nyxor turns market hours into on-chain guardrails—tightening leverage before the reference market sleeps, then reopening with care.
              </p>
              <a href="#comparison" className="mt-5 inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] text-white uppercase transition-colors hover:text-[#d8ff3f]">
                See the risk engine <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          {/* Instance Selector */}
          <div className="nyxor-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-[1.35rem] p-3.5 text-xs">
            <div className="flex items-center gap-2 text-neutral-300">
              <Database className="h-4 w-4 text-[#d8ff3f]" />
              <span className="eyebrow">Deployment target</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDeploymentInstance("benchmark")}
                className={`rounded-full border px-3 py-2 transition-all flex items-center gap-1.5 mono-numbers ${
                  deploymentInstance === "benchmark"
                    ? "border-white bg-white text-black font-bold"
                    : "border-white/10 bg-white/[0.03] text-neutral-500 hover:border-white/30 hover:text-white"
                }`}
              >
                <span>Frozen benchmark</span>
                <span className="hidden md:inline">/ recorded scenario</span>
              </button>
              <button
                onClick={() => setDeploymentInstance("demo")}
                className={`rounded-full border px-3 py-2 transition-all flex items-center gap-1.5 mono-numbers ${
                  deploymentInstance === "demo"
                    ? "border-[#d8ff3f] bg-[#d8ff3f] text-black font-bold"
                    : "border-white/10 bg-white/[0.03] text-neutral-500 hover:border-white/30 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fresh demo</span>
                <span className="hidden md:inline">/ ready to run</span>
              </button>
            </div>
          </div>

          {/* Hero Section: Market Hours Phase Pill */}
          <section aria-label="Market-hours risk status">
            <PhaseHero
              phase={currentPhase}
              secondsToClose={secondsToClose}
              secondsSinceOpen={secondsSinceOpen}
              effectiveNow={effectiveNow}
              guardedMaxLev={guardedParams?.maxLeverageX100}
              guardedReduceOnly={guardedParams?.reduceOnly}
              demoMode={demoMode}
            />
          </section>

          {/* Solvency Comparison: Standard vs Guarded */}
          <section id="comparison">
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
          </section>

          {/* Deployment Record & Live Vault State — no wallet required */}
          <section id="evidence"><RecordedRun /></section>

          {/* Interactive Trading & Position Card */}
          <section id="trade">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-[#d8ff3f]">Trading terminal</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-white">Place risk inside the guardrails.</h2>
              </div>
              <span className="hidden sm:inline mono-numbers text-[11px] text-neutral-500">ORACLE-PRICED / TESTNET ONLY</span>
            </div>
            <TradingPanel
              selectedMarket={selectedMarket}
              onSelectMarket={setSelectedMarket}
              markPrice={selectedPrice}
              maxLeverage={selectedMaxLev}
              reduceOnly={selectedReduceOnly}
              usdcBalance={usdcBalance}
              usdcAllowance={usdcAllowance}
              userPosition={userPosition}
              onRefresh={handleRefreshAll}
            />
          </section>

          {/* Admin Time-Travel & Oracle Gap Shock Console */}
          <AdminConsole isAdmin={isAdmin} onRefresh={handleRefreshAll} />
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/10 bg-black/40 py-12 text-neutral-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 text-white font-bold text-sm tracking-[0.12em]">
              <div className="logo-frame h-7 w-7 rounded-full">
                <Image src="/nyxor-mark.png" alt="" fill sizes="28px" className="object-cover" />
              </div>
              <span>NYXOR PROTOCOL</span>
            </div>
            <p className="mt-3 text-neutral-500 leading-relaxed font-sans text-xs">
              An open-source, market-hours-aware risk layer for RWA perpetual futures.
              Built for the Avalanche "Build Anything" Speedrun Hackathon.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://github.com/rupamghosh2006/NYXOR"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-neutral-500 hover:text-[#d8ff3f] transition-colors mono-numbers"
              >
                <Github className="h-3.5 w-3.5" />
                <span>GitHub Repo</span>
              </a>
            </div>
          </div>

          <div>
            <div className="text-white eyebrow mb-3">
              Verified Fuji Contracts (43113)
            </div>
            <ul className="space-y-2 mono-numbers text-[11px] text-neutral-500">
              <li>
                <a
                  href={`https://testnet.snowscan.xyz/address/${addresses.PerpMarketGuarded}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d8ff3f] flex items-center gap-1"
                >
                  <span>PerpMarketGuarded</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href={`https://testnet.snowscan.xyz/address/${addresses.LiquidityVaultGuarded}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d8ff3f] flex items-center gap-1"
                >
                  <span>LiquidityVaultGuarded</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href={`https://testnet.snowscan.xyz/address/${addresses.MarketHoursRiskPolicy}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d8ff3f] flex items-center gap-1"
                >
                  <span>MarketHoursRiskPolicy</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href={`https://testnet.snowscan.xyz/address/${addresses.MarketClock}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#d8ff3f] flex items-center gap-1"
                >
                  <span>MarketClock</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-white eyebrow mb-3">
              Core Architecture Invariants
            </div>
            <p className="text-neutral-500 leading-relaxed font-sans text-xs">
              "Betting on a stock while the exchange is closed is like betting on a game while the scoreboard is off. Nobody knows the real score until Monday. Nyxor automatically ramps down leverage, deleverages over-cap exposure before close at an open-market price, and eliminates unbacked bad debt."
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
