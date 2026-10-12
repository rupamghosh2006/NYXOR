"use client";

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
import { ExternalLink, Shield, Github, Sparkles, Database } from "lucide-react";

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
    <div className="min-h-screen bg-background flex flex-col justify-between">
      <div>
        <Navbar />
        <Banner demoMode={demoMode} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Instance Selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Database className="h-4 w-4 text-cyan-400" />
              <span>Deployment Target:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDeploymentInstance("benchmark")}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  deploymentInstance === "benchmark"
                    ? "bg-violet-600 text-white font-bold shadow-lg shadow-violet-600/30"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                }`}
              >
                <span>Frozen Benchmark (Scenario Recorded — 7,487.26 USDx Loss Beyond Collateral)</span>
              </button>
              <button
                onClick={() => setDeploymentInstance("demo")}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                  deploymentInstance === "demo"
                    ? "bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-600/30"
                    : "bg-slate-800/80 text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fresh Demo Instance (Untouched — Ready for Video)</span>
              </button>
            </div>
          </div>

          {/* Hero Section: Market Hours Phase Pill */}
          <PhaseHero
            phase={currentPhase}
            secondsToClose={secondsToClose}
            secondsSinceOpen={secondsSinceOpen}
            effectiveNow={effectiveNow}
            guardedMaxLev={guardedParams?.maxLeverageX100}
            guardedReduceOnly={guardedParams?.reduceOnly}
            demoMode={demoMode}
          />

          {/* Solvency Comparison: Standard vs Guarded */}
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

          {/* Deployment Record & Live Vault State — no wallet required */}
          <RecordedRun />

          {/* Interactive Trading & Position Card */}
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

          {/* Admin Time-Travel & Oracle Gap Shock Console */}
          <AdminConsole isAdmin={isAdmin} onRefresh={handleRefreshAll} />
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-slate-900 bg-[#05080E] py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 text-white font-mono font-bold text-sm">
              <Shield className="h-4 w-4 text-violet-400" />
              <span>NYXOR PROTOCOL</span>
            </div>
            <p className="mt-2 text-slate-400 leading-relaxed font-sans text-xs">
              An open-source, market-hours-aware risk layer for RWA perpetual futures.
              Built for the Avalanche "Build Anything" Speedrun Hackathon.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href="https://github.com/rupamghosh2006/NYXOR"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors font-mono"
              >
                <Github className="h-3.5 w-3.5" />
                <span>GitHub Repo</span>
              </a>
            </div>
          </div>

          <div>
            <div className="text-white font-mono font-semibold text-xs uppercase tracking-wider mb-2">
              Verified Fuji Contracts (43113)
            </div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-400">
              <li>
                <a
                  href={`https://testnet.snowscan.xyz/address/${addresses.PerpMarketGuarded}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-cyan-400 flex items-center gap-1"
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
                  className="hover:text-cyan-400 flex items-center gap-1"
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
                  className="hover:text-cyan-400 flex items-center gap-1"
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
                  className="hover:text-cyan-400 flex items-center gap-1"
                >
                  <span>MarketClock</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-white font-mono font-semibold text-xs uppercase tracking-wider mb-2">
              Core Architecture Invariants
            </div>
            <p className="text-slate-400 leading-relaxed font-sans text-xs">
              "Betting on a stock while the exchange is closed is like betting on a game while the scoreboard is off. Nobody knows the real score until Monday. Nyxor automatically ramps down leverage, deleverages over-cap exposure before close at an open-market price, and eliminates unbacked bad debt."
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
