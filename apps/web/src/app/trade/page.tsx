import { Navbar } from "../../components/Navbar";
import { LiveMarketConsole } from "../../components/LiveMarketConsole";
import { SiteFooter } from "../../components/SiteFooter";

export default function TradePage() {
  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="mb-10">
          <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Testnet trading terminal</p>
          <h1 className="mt-4 text-[clamp(3rem,6vw,6rem)] font-extrabold leading-[0.86] tracking-[-0.07em] text-white">Place risk inside the guardrails.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400">Choose the guarded or naive market, inspect the current policy state, and trade only with test collateral.</p>
        </section>
        <LiveMarketConsole view="trade" />
      </main>
      <SiteFooter />
    </div>
  );
}
