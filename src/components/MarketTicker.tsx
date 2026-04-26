import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fetchTokens, type Token } from "@/server/bags";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export function MarketTicker() {
  const [tokens, setTokens] = useState<Token[]>([]);

  useEffect(() => {
    fetchTokens()
      .then((res) => setTokens(res.tokens.slice(0, 12)))
      .catch(() => setTokens([]));
  }, []);

  if (tokens.length === 0) return null;
  const items = [...tokens, ...tokens];
  return (
    <div className="overflow-hidden border-y border-border/60 bg-surface/40">
      <div className="flex animate-ticker gap-10 py-2.5 whitespace-nowrap">
        {items.map((t, i) => (
          <Link
            key={`${t.symbol}-${i}`}
            to="/token/$mint"
            params={{ mint: t.mint }}
            className="flex items-center gap-2 text-sm hover:text-primary transition"
          >
            <span className="font-semibold">${t.symbol}</span>
            <span className="font-mono text-muted-foreground">{formatUsd(t.price)}</span>
            <span className={cn("font-mono", t.change24h >= 0 ? "text-success" : "text-destructive")}>
              {formatPct(t.change24h)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
