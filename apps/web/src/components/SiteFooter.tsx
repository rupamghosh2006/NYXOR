import Image from "next/image";
import Link from "next/link";
import { Github, ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-black/40 py-12 text-neutral-400 text-xs">
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[1.4fr_0.7fr_0.9fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5 text-sm font-bold tracking-[0.12em] text-white">
            <div className="logo-frame relative h-7 w-7 rounded-full">
              <Image src="/nyxor-mark.png" alt="Nyxor mark" fill sizes="28px" className="object-cover" />
            </div>
            <span>NYXOR PROTOCOL</span>
          </div>
          <p className="mt-3 max-w-md leading-relaxed text-neutral-500">
            A market-hours-aware risk layer for RWA perpetual futures. The demo is unaudited, testnet-only, and uses a simulated clock and price feed.
          </p>
          <a
            href="https://github.com/rupamghosh2006/NYXOR"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-fit items-center gap-1.5 mono-numbers text-neutral-500 transition-colors hover:text-[#d8ff3f]"
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub repository</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div>
          <p className="eyebrow text-white">Explore</p>
          <div className="mt-3 flex flex-col gap-2.5 mono-numbers text-[11px]">
            <Link href="/protocol" className="transition-colors hover:text-[#d8ff3f]">Protocol</Link>
            <Link href="/risk" className="transition-colors hover:text-[#d8ff3f]">Risk engine</Link>
            <Link href="/evidence" className="transition-colors hover:text-[#d8ff3f]">On-chain evidence</Link>
            <Link href="/trade" className="transition-colors hover:text-[#d8ff3f]">Trading terminal</Link>
          </div>
        </div>

        <div>
          <p className="eyebrow text-white">Demo disclosure</p>
          <p className="mt-3 leading-relaxed text-neutral-500">
            The on-chain contracts and accounting are live on Avalanche Fuji. Price data, market time, and weekend-gap shocks are simulated for demonstration.
          </p>
        </div>
      </div>
    </footer>
  );
}
