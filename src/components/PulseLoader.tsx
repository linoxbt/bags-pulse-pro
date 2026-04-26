// Lottie-based brand loader using the BagsPulse mark.
// Lottie's runtime touches `document` so we mount it client-only via a
// dynamic import + hydration guard. During SSR we render a CSS pulse fallback.
import { useEffect, useState } from "react";
import animation from "@/assets/bagspulse-lottie.json";
// We type-import Lottie so TS works, but the actual import is dynamic.
import type { LottieComponentProps } from "lottie-react";

interface Props {
  size?: number;
  label?: string;
}

export function PulseLoader({ size = 120, label }: Props) {
  const [LottieCmp, setLottieCmp] = useState<((p: LottieComponentProps) => JSX.Element) | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("lottie-react")
      .then((mod) => {
        if (!cancelled) setLottieCmp(() => mod.default as never);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div style={{ width: size, height: size }} className="relative">
        {LottieCmp ? (
          <LottieCmp animationData={animation} loop autoplay />
        ) : (
          <FallbackPulse size={size} />
        )}
      </div>
      {label && <p className="text-sm text-muted-foreground tracking-wide">{label}</p>}
    </div>
  );
}

function FallbackPulse({ size }: { size: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div
        className="rounded-full bg-gradient-to-br from-primary to-primary-glow pulse-ring"
        style={{ width: size * 0.45, height: size * 0.45 }}
      />
    </div>
  );
}

export function FullPageLoader({ label = "Reading the pulse…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PulseLoader label={label} />
    </div>
  );
}
