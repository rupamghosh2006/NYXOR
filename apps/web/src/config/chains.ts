/**
 * chains.ts — Runtime-configurable chain definitions for Nyxor Protocol.
 *
 * Uses public Fuji RPC endpoints with automatic viem fallback transport:
 * 1. Primary: https://api.avax-test.network/ext/bc/C/rpc
 * 2. Secondary public fallback: https://avalanche-fuji-c-chain-rpc.publicnode.com
 *
 * Both are public testnet endpoints; zero private keys or secrets are required or exposed.
 */

import { type Chain, avalancheFuji } from "wagmi/chains";

/** Public Fuji RPC endpoints (primary + publicnode fallback) */
export const FUJI_PUBLIC_RPCS = [
  process.env.NEXT_PUBLIC_FUJI_RPC_URL || "https://api.avax-test.network/ext/bc/C/rpc",
  "https://avalanche-fuji-c-chain-rpc.publicnode.com",
];

export const FUJI_RPC = FUJI_PUBLIC_RPCS[0];

/** Explorer base URL, no trailing slash. */
export const FUJI_EXPLORER =
  process.env.NEXT_PUBLIC_FUJI_EXPLORER || "https://testnet.snowscan.xyz";

/** Custom Fuji chain definition with fallback RPC list */
export const fujiChain: Chain = {
  ...avalancheFuji,
  rpcUrls: {
    default: { http: FUJI_PUBLIC_RPCS },
    public: { http: FUJI_PUBLIC_RPCS },
  },
};

/** Nyxor L1 chain definition (populated via env or default to live sovereign L1). */
const l1ChainId = process.env.NEXT_PUBLIC_L1_CHAIN_ID
  ? parseInt(process.env.NEXT_PUBLIC_L1_CHAIN_ID, 10)
  : 98421;

const l1RpcUrl =
  process.env.NEXT_PUBLIC_L1_RPC_URL ||
  "https://nodes-prod.43.207.73.245.sslip.io/ext/bc/2SrgwcLrpgt2kLrqhTr6fMaPFd1kN467ai3eaK4HcFyBq1YbaY/rpc";
const l1Explorer =
  process.env.NEXT_PUBLIC_L1_EXPLORER || "https://testnet.snowscan.xyz";
const l1Name = process.env.NEXT_PUBLIC_L1_CHAIN_NAME || "Nyxor L1";

export const l1Chain: Chain = {
  id: l1ChainId,
  name: l1Name,
  nativeCurrency: { name: "NYX", symbol: "NYX", decimals: 18 },
  rpcUrls: {
    default: { http: [l1RpcUrl] },
    public: { http: [l1RpcUrl] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: l1Explorer },
  },
  testnet: true,
};

export type ActiveChain = "fuji" | "l1";

export const ACTIVE_CHAIN_NAME: ActiveChain =
  (process.env.NEXT_PUBLIC_CHAIN as ActiveChain) || "l1";

export const activeChain: Chain =
  ACTIVE_CHAIN_NAME === "l1" ? l1Chain : fujiChain;

export const activeChainId = activeChain.id;

export const activeExplorer =
  ACTIVE_CHAIN_NAME === "l1" ? l1Explorer : FUJI_EXPLORER;

export const supportedChains: [Chain, ...Chain[]] = [l1Chain, fujiChain];
