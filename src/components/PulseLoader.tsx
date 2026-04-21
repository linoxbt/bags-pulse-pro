// "Lottie-style" SVG loader — animated brand pulse using the BagsPulse mark.
// Pure SVG/CSS animation, no extra deps, lightweight, matches the logo identity.

interface Props {
  size?: number;
  label?: string;
}

export function PulseLoader({ size = 96, label }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className="relative flex items-center justify-center rounded-full pulse-ring"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          fill="none"
          aria-hidden
        >
          {/* Bag silhouette */}
          <path
            d="M40 18 h20 l4 8 h-28 z"
            fill="oklch(0.74 0.17 158 / 0.25)"
            stroke="oklch(0.74 0.17 158)"
            strokeWidth="1.5"
          />
          <path
            d="M30 30 Q50 20 70 30 L78 78 Q50 92 22 78 Z"
            fill="oklch(0.74 0.17 158 / 0.18)"
            stroke="oklch(0.82 0.18 158)"
            strokeWidth="1.8"
          />
          {/* Animated pulse line */}
          <polyline
            points="20,55 32,55 38,38 46,72 54,30 62,62 70,55 80,55"
            stroke="oklch(0.92 0.16 158)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-pulse-draw"
          />
        </svg>
      </div>
      {label && (
        <p className="text-sm text-muted-foreground tracking-wide">{label}</p>
      )}
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
