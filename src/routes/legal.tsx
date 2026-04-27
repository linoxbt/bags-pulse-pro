import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal — BagsPulse" },
      { name: "description", content: "Terms of Service and Privacy Policy for BagsPulse." },
    ],
  }),
  component: LegalPage,
});

function LegalPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10 space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Legal & Compliance</h1>
          <p className="text-muted-foreground text-sm">
            Please review our Terms of Service and Privacy Policy before using the platform.
          </p>
        </header>

        <Tabs defaultValue="tos" className="w-full">
          <TabsList className="bg-secondary/40">
            <TabsTrigger value="tos">Terms of Service</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
          </TabsList>
          
          <TabsContent value="tos">
            <Card className="bg-card/60">
              <CardHeader>
                <CardTitle>Terms of Service</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none text-sm text-muted-foreground space-y-4">
                <p>Last updated: 2026-04-27</p>
                <h3 className="text-foreground">1. Acceptance of Terms</h3>
                <p>By accessing BagsPulse, you agree to be bound by these terms. BagsPulse is a dashboard for social finance on the Solana blockchain.</p>
                <h3 className="text-foreground">2. No Financial Advice</h3>
                <p>All information on BagsPulse is for informational purposes only. We do not provide financial, investment, or legal advice. Crypto assets are volatile and risky.</p>
                <h3 className="text-foreground">3. Fees</h3>
                <p>BagsPulse collects protocol fees on certain transactions (e.g., swaps routed via PulseRouter). These fees are non-refundable.</p>
                <h3 className="text-foreground">4. Limitation of Liability</h3>
                <p>BagsPulse is provided "as is" without any warranties. We are not responsible for losses caused by smart contract bugs, network failures, or wallet issues.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="bg-card/60">
              <CardHeader>
                <CardTitle>Privacy Policy</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-invert max-w-none text-sm text-muted-foreground space-y-4">
                <p>Last updated: 2026-04-27</p>
                <h3 className="text-foreground">1. Data Collection</h3>
                <p>We do not collect personal identifying information (PII) like names or emails unless voluntarily provided. We store public wallet addresses used to interact with the platform.</p>
                <h3 className="text-foreground">2. On-Chain Data</h3>
                <p>Information stored on the blockchain is public and transparent. BagsPulse indexes this public data to provide our dashboard features.</p>
                <h3 className="text-foreground">3. Cookies</h3>
                <p>We use local storage to persist your theme preferences and wallet connection state.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}
