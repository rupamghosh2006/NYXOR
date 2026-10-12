/**
 * chains.ts — Runtime-configurable chain definitions for Nyxor Protocol.
 *
 * Active chain is selected by NEXT_PUBLIC_CHAIN env var ("fuji" | "l1").
 * This module intentionally has no hard-coded addresses; those live in contracts.ts.
 * Swap the env var (or add a chain toggle in the UI) to point the app at a different network.
 */

import { type Chain, avalancheFuji } from "wagmi/chains";

/** Public Fuji RPC, overridable via env to avoid rate-limiting. */
export const FUJI_RPC =
  process.env.NEXT_PUBLIC_FUJI_RPC_URL ||
  "https://api.avax-test.network/ext/bc/C/rpc";

/** Explorer base URL, no trailing slash. */
export const FUJI_EXPLORER =
  process.env.NEXT_PUBLIC_FUJI_EXPLORER || "https://testnet.snowscan.xyz";

/** Custom Fuji chain definition that uses the configurable RPC. */
export const fujiChain: Chain = {
  ...avalancheFuji,
  rpcUrls: {
    default: { http: [FUJI_RPC] },
    public: { http: [FUJI_RPC] },
  },
};

/** Nyxor L1 chain definition (stretch — populated via env after L1 deployment). */
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

/** Which chain is active right now based on env config. */
export type ActiveChain = "fuji" | "l1";

export const ACTIVE_CHAIN_NAME: ActiveChain =
  (process.env.NEXT_PUBLIC_CHAIN as ActiveChain) || "fuji";

/** The active Chain object. Falls back to fuji if L1 env not set. */
export const activeChain: Chain =
  ACTIVE_CHAIN_NAME === "l1" && l1Chain ? l1Chain : fujiChain;

export const activeChainId = activeChain.id;

/** Explorer for the active chain. */
export const activeExplorer =
  ACTIVE_CHAIN_NAME === "l1" && l1Explorer ? l1Explorer : FUJI_EXPLORER;

/** Supported chains array (always includes fuji; adds l1 if configured). */
export const supportedChains: [Chain, ...Chain[]] = l1Chain
  ? [fujiChain, l1Chain]
  : [fujiChain];
