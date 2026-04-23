// Ambient moving background — soft drifting gradient orbs + animated mesh.
// Sits behind all content (z-0) and is purely decorative.
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Drifting orbs */}
      <div className="absolute -top-32 -left-24 h-[34rem] w-[34rem] rounded-full bg-primary/15 blur-3xl animate-orb-a" />
      <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-3xl animate-orb-b" />
      <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-3xl animate-orb-c" />
      {/* Subtle moving grid */}
      <div className="absolute inset-0 bg-grid opacity-[0.08] animate-grid-drift [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
    </div>
  );
}
