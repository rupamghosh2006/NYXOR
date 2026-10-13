import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { LiveMarketConsole } from "../../components/LiveMarketConsole";
import { Artwork } from "../../components/Artwork";
import { SiteFooter } from "../../components/SiteFooter";

export default function RiskPage() {
  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="mb-10 grid gap-8 lg:grid-cols-[1fr_0.55fr] lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Live policy state</p>
            <h1 className="mt-4 text-[clamp(3rem,6vw,6rem)] font-extrabold leading-[0.86] tracking-[-0.07em] text-white">Risk does not stay flat when the market shuts.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-400">Monitor the market phase, dynamic caps, vault accounting, and the recorded Standard-versus-Guarded outcome.</p>
          </div>
          <div className="space-y-4">
            <Artwork
              src="/risk-shield.jpg"
              alt="An abstract violet circuit image representing risk controls"
              label="/public/risk-shield.jpg"
              className="min-h-[190px] rounded-[1.5rem] border border-white/10"
              priority
            />
            <Link href="/evidence" className="inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-neutral-300 transition hover:text-[#d8ff3f]">Read the scenario evidence <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </section>
        <LiveMarketConsole view="risk" />
      </main>
      <SiteFooter />
    </div>
  );
}
