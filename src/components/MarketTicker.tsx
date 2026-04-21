import { getSampleTokens } from "@/lib/sample-data";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MarketTicker() {
  // Tiny client-side ticker using sample data — replaced by live in dashboard
  const tokens = getSampleTokens().slice(0, 12);
  const items = [...tokens, ...tokens];
  return (
    <div className="overflow-hidden border-y border-border/60 bg-surface/40">
      <div className="flex animate-ticker gap-10 py-2.5 whitespace-nowrap">
        {items.map((t, i) => (
          <div key={`${t.symbol}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="font-semibold">${t.symbol}</span>
            <span className="font-mono text-muted-foreground">{formatUsd(t.price)}</span>
            <span
              className={cn(
                "font-mono",
                t.change24h >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {formatPct(t.change24h)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
