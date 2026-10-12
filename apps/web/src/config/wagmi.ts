import { http, createConfig, injected, fallback } from "wagmi";
import { fujiChain, l1Chain, supportedChains, FUJI_PUBLIC_RPCS } from "./chains";

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [
    injected(),
  ],
  transports: {
    [fujiChain.id]: fallback(FUJI_PUBLIC_RPCS.map((url) => http(url))),
    ...(l1Chain ? { [l1Chain.id]: http(l1Chain.rpcUrls.default.http[0]) } : {}),
  },
  ssr: true,
});
