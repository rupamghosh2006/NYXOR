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

/** Nyxor L1 chain definition (populated via env after L1 deployment). */
const l1ChainId = process.env.NEXT_PUBLIC_L1_CHAIN_ID
  ? parseInt(process.env.NEXT_PUBLIC_L1_CHAIN_ID, 10)
  : undefined;

const l1RpcUrl = process.env.NEXT_PUBLIC_L1_RPC_URL;
const l1Explorer = process.env.NEXT_PUBLIC_L1_EXPLORER;
const l1Name = process.env.NEXT_PUBLIC_L1_CHAIN_NAME || "Nyxor L1";

export const l1Chain: Chain | undefined =
  l1ChainId && l1RpcUrl
    ? {
        id: l1ChainId,
        name: l1Name,
        nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
        rpcUrls: {
          default: { http: [l1RpcUrl] },
          public: { http: [l1RpcUrl] },
        },
        blockExplorers: l1Explorer
          ? { default: { name: "Explorer", url: l1Explorer } }
          : undefined,
        testnet: true,
      }
    : undefined;

export type ActiveChain = "fuji" | "l1";

export const ACTIVE_CHAIN_NAME: ActiveChain =
  (process.env.NEXT_PUBLIC_CHAIN as ActiveChain) || "fuji";

export const activeChain: Chain =
  ACTIVE_CHAIN_NAME === "l1" && l1Chain ? l1Chain : fujiChain;

export const activeChainId = activeChain.id;

export const activeExplorer =
  ACTIVE_CHAIN_NAME === "l1" && l1Explorer ? l1Explorer : FUJI_EXPLORER;

export const supportedChains: [Chain, ...Chain[]] = l1Chain
  ? [fujiChain, l1Chain]
  : [fujiChain];
