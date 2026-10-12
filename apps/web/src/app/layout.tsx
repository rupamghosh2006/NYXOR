import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Nyxor Protocol | Market-Hours-Aware Risk Layer",
  description: "The market closes on Friday. Your risk shouldn't. Dynamic risk, pre-close deleveraging, and gap protection for RWA perpetuals on Avalanche.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-background text-slate-100 antialiased selection:bg-accent-violet/30 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
