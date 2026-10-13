"use client";

import Image from "next/image";
import { useState } from "react";

interface ArtworkProps {
  src: string;
  alt: string;
  label: string;
  className?: string;
  priority?: boolean;
}

/**
 * External artwork is intentionally user-supplied. Until an asset is added to
 * public/nyxor, this keeps the layout polished instead of showing a broken image.
 */
export function Artwork({ src, alt, label, className = "", priority = false }: ArtworkProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-[#0a0a0a] ${className}`}>
      {!failed && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-700 hover:scale-[1.03]"
          priority={priority}
          onError={() => setFailed(true)}
        />
      )}

      <div className={`absolute inset-0 ${failed ? "opacity-100" : "opacity-0"} transition-opacity`} aria-hidden={!failed}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(167,139,250,.26),transparent_30%),radial-gradient(circle_at_22%_75%,rgba(216,255,63,.13),transparent_26%)]" />
        <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="eyebrow text-[#d8ff3f]">Artwork placeholder</p>
          <p className="mt-1 mono-numbers text-[11px] text-neutral-400">{label}</p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15" />
    </div>
  );
}
