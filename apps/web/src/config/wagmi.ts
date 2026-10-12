import { http, createConfig, injected } from "wagmi";
import { avalancheFuji } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [avalancheFuji],
  connectors: [
    injected(),
  ],
  transports: {
    [avalancheFuji.id]: http("https://api.avax-test.network/ext/bc/C/rpc"),
  },
  ssr: true,
});
