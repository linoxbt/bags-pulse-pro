import logo from "@/assets/bagspulse-logo.png";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  withWordmark?: boolean;
  size?: number;
}

export function BagsPulseLogo({ className, withWordmark = true, size = 36 }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/10 ring-1 ring-primary/30"
        style={{ width: size, height: size }}
      >
        <img
          src={logo}
          alt="BagsPulse"
          width={size - 8}
          height={size - 8}
          className="object-contain"
          loading="lazy"
        />
      </div>
      {withWordmark && (
        <span className="font-semibold tracking-tight text-foreground text-lg">
          Bags<span className="text-gradient">Pulse</span>
        </span>
      )}
    </div>
  );
}
