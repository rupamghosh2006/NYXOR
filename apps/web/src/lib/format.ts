/**
 * Format helpers for Nyxor Protocol UI
 * USDC: 6 decimals
 * Prices: 8 decimals
 * Basis points: 1e4 (100 bps = 1%)
 */

export function formatUsdx(rawUnits: bigint | number | undefined, decimals = 2): string {
  if (rawUnits === undefined || rawUnits === null) return "0.00 USDx";
  const num = typeof rawUnits === "bigint" ? Number(rawUnits) / 1e6 : rawUnits / 1e6;
  return `${num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} USDx`;
}

export function formatPrice(rawUnits: bigint | number | undefined, decimals = 2): string {
  if (rawUnits === undefined || rawUnits === null) return "$0.00";
  const num = typeof rawUnits === "bigint" ? Number(rawUnits) / 1e8 : rawUnits / 1e8;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function formatBps(bps: bigint | number | undefined): string {
  if (bps === undefined || bps === null) return "0.00%";
  const num = typeof bps === "bigint" ? Number(bps) / 100 : bps / 100;
  return `${num.toFixed(2)}%`;
}

export function formatLeverage(x100: bigint | number | undefined): string {
  if (x100 === undefined || x100 === null) return "0.00x";
  const num = typeof x100 === "bigint" ? Number(x100) / 100 : x100 / 100;
  return `${num.toFixed(2)}x`;
}

export function formatUtcTime(timestampSeconds: bigint | number | undefined): string {
  if (!timestampSeconds) return "--:--:-- UTC";
  const sec = typeof timestampSeconds === "bigint" ? Number(timestampSeconds) : timestampSeconds;
  const d = new Date(sec * 1000);
  return d.toUTCString().replace("GMT", "UTC");
}

export function formatDuration(seconds: bigint | number | undefined): string {
  if (seconds === undefined || seconds === null) return "--";
  const s = typeof seconds === "bigint" ? Number(seconds) : seconds;
  if (s < 0) return "0s";
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function shortenAddress(address: string | undefined): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
