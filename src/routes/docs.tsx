import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Developer docs — BagsPulse" },
      { name: "description", content: "PulseRouter SDK reference and Bags API integration guide." },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-10">
        <header className="space-y-3">
          <p className="text-sm text-primary font-semibold uppercase tracking-widest">Developer docs</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Build with PulseRouter SDK
          </h1>
          <p className="text-muted-foreground">
            Earn protocol fees on every token your app helps launch. Wrap the
            official <code className="px-1 font-mono bg-secondary rounded">@bagsfm/bags-sdk</code> with our drop-in router.
          </p>
        </header>

        <Section title="1. Install">
          <Code>{`npm install @pulserouter/sdk @bagsfm/bags-sdk @solana/web3.js`}</Code>
        </Section>

        <Section title="2. Register your app">
          <p className="text-sm text-muted-foreground">
            One-time on-chain registration creates a partner config PDA scoped
            to your app wallet. 0.1 SOL fee.
          </p>
          <Code>{`import { PulseRouter } from "@pulserouter/sdk";

await PulseRouter.registerPartner({
  appId: "your-app-id",
  feeWallet: yourAppWallet,
  bps: 1500,            // your share per launch (15%)
});`}</Code>
        </Section>

        <Section title="3. Launch tokens through the router">
          <Code>{`import { PulseRouter } from "@pulserouter/sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection(process.env.HELIUS_RPC_URL!);
const router = new PulseRouter({
  apiKey: process.env.BAGS_API_KEY!,
  appId: "your-app-id",
  connection,
});

// Auto-inserts fee splits:
//   creator   8000 BPS (80%)
//   your app  1500 BPS (15%)
//   protocol   500 BPS  (5%)
const result = await router.launchToken({
  name: "My Token",
  symbol: "MTK",
  creatorWallet: creatorPubkey,
  creatorBps: 8000,
  appBps: 1500,
});`}</Code>
        </Section>

        <Section title="4. Claim accumulated fees">
          <Code>{`const positions = await router.getAllClaimablePositions(yourAppWallet);
const txs = await router.getClaimTransactions(positions);
// sign + send
`}</Code>
        </Section>

        <Section title="Resources">
          <ul className="text-sm space-y-2">
            <li>· Bags docs · <a className="text-primary hover:underline" href="https://docs.bags.fm" target="_blank" rel="noreferrer">docs.bags.fm</a></li>
            <li>· Bags SDK · <a className="text-primary hover:underline" href="https://github.com/bagsfm/bags-sdk" target="_blank" rel="noreferrer">github.com/bagsfm/bags-sdk</a></li>
            <li>· Helius RPC · <a className="text-primary hover:underline" href="https://docs.helius.dev" target="_blank" rel="noreferrer">docs.helius.dev</a></li>
            <li>· Fee program · <code className="font-mono">FEE2tBhCKAt7shrod19QttSVREUYPiyMzoku1mL1gqVK</code></li>
          </ul>
          <p className="pt-4 text-sm">
            Ready to launch? <Link to="/router" className="text-primary hover:underline">Open the marketplace →</Link>
          </p>
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card/60">
      <CardHeader className="border-b border-border/50">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-4 text-xs font-mono leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
