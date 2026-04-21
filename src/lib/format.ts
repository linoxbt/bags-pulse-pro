export function formatUsd(n: number, opts: { compact?: boolean } = {}) {
  if (n == null || isNaN(n)) return "$0";
  if (opts.compact) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
      style: "currency",
      currency: "USD",
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 ? 6 : 2,
  }).format(n);
}

export function formatNumber(n: number, compact = true) {
  if (n == null || isNaN(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPct(n: number) {
  if (n == null || isNaN(n)) return "0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function shortAddress(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function timeAgo(d: Date | string | number) {
  const date = new Date(d);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
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
