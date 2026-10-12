import { http, createConfig, injected } from "wagmi";
import { fujiChain, l1Chain, supportedChains, FUJI_RPC, activeChain } from "./chains";

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
  ],
  transports: Object.fromEntries(
    supportedChains.map((chain) => [
      chain.id,
      http(
        chain.id === fujiChain.id
          ? FUJI_RPC
          : (l1Chain && chain.id === l1Chain.id ? chain.rpcUrls.default.http[0] : undefined)
      ),
    ])
  ),
  ssr: true,
});
