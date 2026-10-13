import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Artwork } from "../../components/Artwork";
import { RecordedRun } from "../../components/RecordedRun";
import { SiteFooter } from "../../components/SiteFooter";

export default function EvidencePage() {
  return (
    <div className="nyxor-shell">
      <Navbar />
      <main className="max-w-7xl mx-auto space-y-12 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <section className="grid gap-8 lg:grid-cols-[1fr_0.86fr] lg:items-end">
          <div>
            <p className="eyebrow flex items-center gap-2 text-[#d8ff3f]"><span className="signal-dot" /> Verifiable scenario</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(3rem,6vw,6.2rem)] font-extrabold leading-[0.86] tracking-[-0.07em] text-white">The outcome should be as visible as the thesis.</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-400">A deterministic -8% simulated reopening gap is broadcast to Fuji, where two market policies settle the exact same scenario differently.</p>
          </div>
          <Artwork
            src="/gap-risk.jpg"
            alt="An abstract fractured line representing a weekend market gap"
            label="/public/gap-risk.jpg"
            className="min-h-[300px] rounded-[1.75rem] border border-white/10"
            priority
          />
        </section>

        <section className="grid gap-px overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10 md:grid-cols-3">
          <div className="bg-[#0a0a0a] p-6">
            <CheckCircle2 className="h-5 w-5 text-[#d8ff3f]" />
            <p className="mt-7 eyebrow text-neutral-500">Standard policy</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-white">Static 20x continues across the close.</h2>
          </div>
          <div className="bg-[#0a0a0a] p-6">
            <CheckCircle2 className="h-5 w-5 text-violet-300" />
            <p className="mt-7 eyebrow text-neutral-500">Guarded policy</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-white">Over-cap positions are cut to 5x before close.</h2>
          </div>
          <div className="bg-[#0a0a0a] p-6">
            <CheckCircle2 className="h-5 w-5 text-cyan-200" />
            <p className="mt-7 eyebrow text-neutral-500">Recorded truth</p>
            <h2 className="mt-2 text-xl font-bold tracking-[-0.04em] text-white">Transactions and vault accounting are exposed below.</h2>
          </div>
        </section>

        <RecordedRun />

        <section className="flex flex-col justify-between gap-5 rounded-[1.75rem] border border-white/10 bg-white/[0.025] p-7 sm:flex-row sm:items-end sm:p-9">
          <div>
            <p className="eyebrow text-[#d8ff3f]">Continue exploring</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-white">Watch the live policy state react.</h2>
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
