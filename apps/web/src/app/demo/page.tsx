import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { LiveMarketConsole } from "../../components/LiveMarketConsole";
import { SiteFooter } from "../../components/SiteFooter";

export default function DemoPage() {
  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="mb-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Scenario controls</p>
            <h1 className="mt-4 text-[clamp(3rem,6vw,6rem)] font-extrabold leading-[0.86] tracking-[-0.07em] text-white">Replay the weekend gap.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400">Admin-only controls advance the simulated clock, refresh the mock feed, and trigger the deterministic gap demonstration.</p>
          </div>
          <Link href="/evidence" className="inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-neutral-300 transition hover:text-[#d8ff3f]">View recorded run <ArrowUpRight className="h-4 w-4" /></Link>
        </section>
        <LiveMarketConsole view="demo" />
      </main>
      <SiteFooter />
    </div>
  );
}
