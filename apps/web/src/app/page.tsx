import Link from "next/link";
import { ArrowUpRight, Clock3, ShieldCheck, Waves, ArrowRight } from "lucide-react";
import { Navbar } from "../components/Navbar";
import { Artwork } from "../components/Artwork";
import { SiteFooter } from "../components/SiteFooter";

const principles = [
  {
    number: "01",
    title: "Tighten before close",
    detail: "Leverage and open-interest caps contract while the reference market is still open and price discovery is reliable.",
    icon: Clock3,
  },
  {
    number: "02",
    title: "Cut risk, not corners",
    detail: "Over-cap positions are deleveraged to the closed-market cap before the weekend gap can create a shortfall.",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Reopen with care",
    detail: "A controlled cooldown gives the protocol room to price the opening gap and absorb risk transparently.",
    icon: Waves,
  },
];

export default function Home() {
  return (
    <div className="nyxor-shell">
      <Navbar />

      <div className="border-b border-[#d8ff3f]/20 bg-[#d8ff3f]/[0.07] px-4 py-2.5 text-xs mono-numbers text-neutral-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span><strong className="text-[#d8ff3f]">SIMULATED CLOCK & ORACLE:</strong> price and time are demo controls; contracts and risk policy run on Fuji.</span>
          <span className="text-neutral-500">TESTNET ONLY / UNAUDITED</span>
        </div>
      </div>

      <div className="overflow-hidden border-b border-white/10 bg-white/[0.025] py-2">
        <div className="ticker-track whitespace-nowrap eyebrow text-neutral-500">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="mr-10 inline-flex items-center gap-3">
              <span className="text-[#d8ff3f]">◆</span> NYXOR / MARKET-HOURS RISK ENGINE
              <span className="text-violet-300">—</span> PRE-CLOSE DELEVERAGING
              <span className="text-[#d8ff3f]">—</span> FUJI TESTNET / SIMULATED ORACLE
            </span>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto space-y-20 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="grid items-end gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10 py-4 lg:py-9">
            <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Market-hours-aware perpetuals</p>
            <h1 className="mt-5 max-w-4xl text-[clamp(3.2rem,8vw,8rem)] font-extrabold leading-[0.84] tracking-[-0.075em] text-white">
              The market closes.<br />
              <span className="text-neutral-500">Your risk shouldn&apos;t.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-400">
              Nyxor is a market-hours-aware risk engine for stock and commodity perpetuals—built to keep weekend gaps from becoming bad debt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/risk" className="inline-flex items-center gap-2 rounded-full bg-[#d8ff3f] px-5 py-3 text-xs font-extrabold tracking-[0.05em] text-black transition hover:bg-[#e5ff7a]">
                Explore the risk engine <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link href="/trade" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-xs font-bold tracking-[0.05em] text-white transition hover:border-white/35">
                Open the terminal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <Artwork
            src="/hero-night-exchange.jpg"
            alt="A financial district at night"
            label="/public/hero-night-exchange.jpg"
            className="min-h-[360px] rounded-[2rem] border border-white/10 lg:min-h-[570px]"
            priority
          />
        </section>

        <section className="grid gap-px overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/10 md:grid-cols-3">
          {principles.map(({ number, title, detail, icon: Icon }) => (
            <article key={number} className="bg-[#0a0a0a]/90 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="mono-numbers text-sm text-[#d8ff3f]">{number}</span>
                <Icon className="h-5 w-5 text-neutral-400" />
              </div>
              <h2 className="mt-12 text-2xl font-extrabold tracking-[-0.045em] text-white">{title}</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-neutral-500">{detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <Artwork
            src="/gap-risk.jpg"
            alt="An abstract image representing a market gap"
            label="/public/gap-risk.jpg"
            className="min-h-[340px] rounded-[1.75rem] border border-white/10"
          />
          <div className="lg:px-8">
            <p className="eyebrow text-[#d8ff3f]">The gap problem</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-extrabold leading-[0.95] tracking-[-0.06em] text-white sm:text-5xl">
              Liquidations need a price path. Weekends don&apos;t provide one.
            </h2>
            <p className="mt-6 max-w-xl leading-7 text-neutral-400">
              A 20x position can become undercollateralized after a 5% gap. Nyxor shrinks exposure in advance at an open-market price, so the protocol is prepared when the reference exchange is dark.
            </p>
            <Link href="/protocol" className="mt-6 inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase text-white transition-colors hover:text-[#d8ff3f]">
              How the protocol works <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="nyxor-card rounded-[1.75rem] p-7 sm:p-10">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow text-[#d8ff3f]">Start with the proof</p>
              <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-[-0.05em] text-white sm:text-4xl">Same positions. Same gap. Different outcome.</h2>
              <p className="mt-3 max-w-2xl leading-7 text-neutral-500">Compare a naive 24/7 market with Nyxor&apos;s guarded policy using the recorded Fuji weekend-gap scenario.</p>
            </div>
            <Link href="/evidence" className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-xs font-bold tracking-[0.06em] text-white transition hover:border-[#d8ff3f] hover:text-[#d8ff3f]">
              View on-chain evidence <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
