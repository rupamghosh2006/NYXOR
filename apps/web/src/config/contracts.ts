import fujiDeployments from "../../../../deployments/fuji.json";

export const FUJI_CHAIN_ID = 43113;

export const CONTRACT_ADDRESSES = {
  DemoUSDC: fujiDeployments.DemoUSDC as `0x${string}`,
  MarketClock: fujiDeployments.MarketClock as `0x${string}`,
  MarketSchedule: fujiDeployments.MarketSchedule as `0x${string}`,
  MockPriceFeedStandard: fujiDeployments.MockPriceFeedStandard as `0x${string}`,
  MockPriceFeedGuarded: fujiDeployments.MockPriceFeedGuarded as `0x${string}`,
  FlatRiskPolicy: fujiDeployments.FlatRiskPolicy as `0x${string}`,
  MarketHoursRiskPolicy: fujiDeployments.MarketHoursRiskPolicy as `0x${string}`,
  LiquidityVaultStandard: fujiDeployments.LiquidityVaultStandard as `0x${string}`,
  LiquidityVaultGuarded: fujiDeployments.LiquidityVaultGuarded as `0x${string}`,
  PerpMarketStandard: fujiDeployments.PerpMarketStandard as `0x${string}`,
  PerpMarketGuarded: fujiDeployments.PerpMarketGuarded as `0x${string}`,
  Deployer: fujiDeployments.Deployer as `0x${string}`,
};

export const MARKET_CLOCK_ABI = [
  {
    type: "function",
    name: "effectiveNow",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "demoMode",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "demoOffset",
    inputs: [],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setDemoOffset",
    inputs: [{ name: "offset", type: "int256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "advance",
    inputs: [{ name: "seconds_", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasRole",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export const MARKET_SCHEDULE_ABI = [
  {
    type: "function",
    name: "phaseAt",
    inputs: [{ name: "ts", type: "uint256" }],
    outputs: [
      { name: "phase", type: "uint8" },
      { name: "secondsToClose", type: "uint256" },
      { name: "secondsSinceOpen", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "preCloseWindow",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "reopenCooldown",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const PRICE_FEED_ABI = [
  {
    type: "function",
    name: "latestPrice",
    inputs: [],
    outputs: [
      { name: "price1e8", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastOfficialClosePrice",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPrice",
    inputs: [{ name: "newPrice1e8", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "queueShock",
    inputs: [{ name: "bps", type: "int256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "checkpointClose",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const RISK_POLICY_ABI = [
  {
    type: "function",
    name: "getParams",
    inputs: [{ name: "ts", type: "uint256" }],
    outputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "phase", type: "uint8" },
          { name: "maxLeverageX100", type: "uint16" },
          { name: "initialMarginBps", type: "uint16" },
          { name: "maintenanceMarginBps", type: "uint16" },
          { name: "maxOpenInterestUsd", type: "uint256" },
          { name: "maxPositionUsd", type: "uint256" },
          { name: "fundingMultiplierBps", type: "uint16" },
          { name: "reduceOnly", type: "bool" },
          { name: "deleverageTargetX100", type: "uint16" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

export const LIQUIDITY_VAULT_ABI = [
  {
    type: "function",
    name: "vaultAssets",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "insuranceFund",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "badDebtTotal",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockedExposure",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const PERP_MARKET_ABI = [
  {
    type: "function",
    name: "totalOiLongUsd",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalOiShortUsd",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPosition",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "active", type: "bool" },
          { name: "isLong", type: "bool" },
          { name: "sizeUsd", type: "uint256" },
          { name: "collateral", type: "uint256" },
          { name: "entryPrice", type: "uint256" },
          { name: "fundingIndexSnapshot", type: "int256" },
          { name: "openedAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getEquity",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLeverage",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getLiquidationPrice",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "openPosition",
    inputs: [
      { name: "isLong", type: "bool" },
      { name: "margin", type: "uint256" },
      { name: "leverageX100", type: "uint16" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "closePosition",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addMargin",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deleverageToCap",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
