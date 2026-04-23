import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

interface Props {
  date: string | number | Date;
  className?: string;
  /** Refresh the rendered string this often (ms). Defaults to 30s. */
  refreshMs?: number;
}

/**
 * Hydration-safe relative time. Renders an empty placeholder during SSR and
 * the first client paint, then mounts the live value. This prevents server
 * vs. client mismatches caused by clock drift between Node and the browser.
 */
export function RelativeTime({ date, className, refreshMs = 30_000 }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  if (now === null) {
    // Stable SSR / first-paint placeholder
    return <span className={className} suppressHydrationWarning>just now</span>;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {timeAgo(date, now)}
    </span>
  );
}
