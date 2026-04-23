// Lottie-based brand loader using the BagsPulse mark.
import Lottie from "lottie-react";
import animation from "@/assets/bagspulse-lottie.json";

interface Props {
  size?: number;
  label?: string;
}

export function PulseLoader({ size = 120, label }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div style={{ width: size, height: size }}>
        <Lottie animationData={animation} loop autoplay />
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
