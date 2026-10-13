import Link from "next/link";
import { ArrowUpRight, Landmark, Network, ShieldCheck } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Artwork } from "../../components/Artwork";
import { SiteFooter } from "../../components/SiteFooter";

const layers = [
  { title: "Fuji C-Chain", detail: "Test collateral originates where Avalanche test liquidity lives.", accent: "text-cyan-200" },
  { title: "Nyxor L1", detail: "The isolated risk environment carries its own market rules and approved participants.", accent: "text-violet-200" },
  { title: "Market policy", detail: "Time-aware leverage, margin, OI, and funding limits are enforced on-chain.", accent: "text-[#d8ff3f]" },
];

export default function ProtocolPage() {
  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto space-y-20 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Protocol overview</p>
            <h1 className="mt-4 max-w-3xl text-[clamp(3rem,6vw,6.2rem)] font-extrabold leading-[0.86] tracking-[-0.07em] text-white">
              A risk engine that knows when the market is asleep.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-400">
              Nyxor is not an order book. It is an on-chain policy layer for a minimal RWA perps market, built around the moments where a reference market closes and reopens.
            </p>
          </div>
          <Artwork
            src="/market-clock.jpg"
            alt="An abstract clock representing global market hours"
            label="/public/market-clock.jpg"
            className="min-h-[360px] rounded-[1.75rem] border border-white/10"
            priority
          />
        </section>

        <section className="nyxor-card overflow-hidden rounded-[1.75rem]">
          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <p className="eyebrow text-[#d8ff3f]">Three execution layers</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-white">Collateral moves. Policy decides. Markets settle.</h2>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-3">
            {layers.map((layer, index) => (
              <article key={layer.title} className="min-h-[230px] bg-[#0b0b0b] p-6 sm:p-8">
                <span className="mono-numbers text-xs text-neutral-600">0{index + 1}</span>
                <h3 className={`mt-10 text-2xl font-extrabold tracking-[-0.04em] ${layer.accent}`}>{layer.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-6 text-neutral-500">{layer.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-6">
            <Landmark className="h-5 w-5 text-[#d8ff3f]" />
            <h2 className="mt-8 text-xl font-bold tracking-[-0.04em] text-white">ICTT collateral path</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">A demo bridge is designed to bring USDC-like collateral from Fuji C-Chain into Nyxor&apos;s L1 environment.</p>
          </article>
          <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-6">
            <Network className="h-5 w-5 text-violet-300" />
            <h2 className="mt-8 text-xl font-bold tracking-[-0.04em] text-white">Permissioned execution</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">The target L1 is designed around chain-level participant controls appropriate to a regulated-asset demo.</p>
          </article>
          <article className="rounded-[1.4rem] border border-white/10 bg-white/[0.025] p-6">
            <ShieldCheck className="h-5 w-5 text-cyan-200" />
            <h2 className="mt-8 text-xl font-bold tracking-[-0.04em] text-white">Explicit limits</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-500">Mock oracle data and a fixed-UTC calendar are disclosed. This is a testnet prototype, not a production exchange.</p>
          </article>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <Artwork
            src="/avalanche-network.jpg"
            alt="A mountain illustration representing Avalanche network infrastructure"
            label="/public/avalanche-network.jpg"
            className="min-h-[300px] rounded-[1.75rem] border border-white/10 bg-white"
          />
          <div className="lg:px-8">
            <p className="eyebrow text-[#d8ff3f]">Avalanche-native by design</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-[0.94] tracking-[-0.06em] text-white">A controlled market environment, not just another frontend.</h2>
            <p className="mt-5 max-w-xl leading-7 text-neutral-400">Nyxor&apos;s intended architecture separates test collateral on Fuji from a purpose-built L1 market environment, then makes the risk regime explicit in contracts and in the interface.</p>
          </div>
        </section>

        <section className="flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[#d8ff3f]/25 bg-[#d8ff3f]/[0.055] p-7 sm:flex-row sm:items-end sm:p-9">
          <div>
            <p className="eyebrow text-[#d8ff3f]">Next, see the policy in motion</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-white">The same contract sees a different market state.</h2>
          </div>
          <Link href="/risk" className="inline-flex w-fit items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-white transition hover:text-[#d8ff3f]">
            Open risk engine <ArrowUpRight className="h-4 w-4" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
