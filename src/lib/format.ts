// Custom compact formatter that's deterministic across SSR/client.
// Native Intl `compact` differs between Node ICU and browser ICU
// (e.g. "$32.4M" vs "$32.40M"), causing hydration mismatches.

function compactNumber(n: number, fractionDigits = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(fractionDigits).replace(/\.?0+$/, "")}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(fractionDigits).replace(/\.?0+$/, "")}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(fractionDigits).replace(/\.?0+$/, "")}K`;
  return `${sign}${abs.toFixed(abs < 1 ? Math.min(6, fractionDigits + 4) : 0)}`;
}

export function formatUsd(n: number, opts: { compact?: boolean } = {}) {
  if (n == null || isNaN(n)) return "$0";
  if (opts.compact) {
    return `$${compactNumber(n, 2)}`;
  }
  // Standard USD with explicit fraction control (Node + browser identical)
  const abs = Math.abs(n);
  const fractionDigits = abs < 1 ? 6 : 2;
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits === 6 ? 2 : 2,
    maximumFractionDigits: fractionDigits,
  });
  return `${n < 0 ? "-" : ""}$${formatted}`;
}

export function formatNumber(n: number, compact = true) {
  if (n == null || isNaN(n)) return "0";
  if (compact) return compactNumber(n, 2);
  return Math.round(n).toLocaleString("en-US");
}

export function formatPct(n: number) {
  if (n == null || isNaN(n)) return "0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function shortAddress(addr: string) {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function timeAgo(d: Date | string | number, nowMs?: number) {
  const date = new Date(d);
  // `nowMs` lets callers freeze the reference time (used to skip SSR/CSR drift
  // by deferring rendering until after mount). When omitted we fall back to a
  // bucketed Date.now() to minimize hydration mismatches.
  const reference = nowMs ?? Date.now();
  const seconds = Math.floor((reference - date.getTime()) / 1000);
  const intervals: [number, string][] = [
    [60, "s"],
    [60, "m"],
    [24, "h"],
    [7, "d"],
    [4.34, "w"],
    [12, "mo"],
  ];
  let value = seconds;
  let unit = "s";
  for (const [step, label] of intervals) {
    if (value < step) {
      unit = label;
      break;
    }
    value = value / step;
    unit = label;
  }
  return `${Math.max(1, Math.floor(value))}${unit} ago`;
}
