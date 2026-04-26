// PulseRouter partner registry — register, verify (DNS TXT + on-chain wallet
// signature), list. Verification is gated by the server, not client-trust.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Partner = {
  id: string;
  user_id: string;
  app_id: string;
  app_name: string;
  fee_wallet: string;
  bps: number;
  description: string | null;
  website: string | null;
  total_tokens_launched: number;
  total_fees_earned: number;
  is_active: boolean;
  domain_verified: boolean;
  wallet_verified: boolean;
  verification_token: string | null;
  verification_challenge: string | null;
  verified_at: string | null;
};

function randomToken(prefix: string) {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}_${hex}`;
}

function hostFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host;
  } catch {
    return null;
  }
}

export const registerPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      app_id: string;
      app_name: string;
      fee_wallet: string;
      bps: number;
      description?: string;
      website?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.app_id.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60);
    if (slug.length < 3) throw new Error("app_id must be at least 3 characters");
    if (data.bps < 100 || data.bps > 5000) throw new Error("bps must be 100-5000");

    const { data: row, error } = await supabase
      .from("partner_registry")
      .insert({
        user_id: userId,
        app_id: slug,
        app_name: data.app_name.slice(0, 80),
        fee_wallet: data.fee_wallet,
        bps: data.bps,
        description: data.description?.slice(0, 280) ?? null,
        website: data.website || null,
        is_active: false, // gated until verified
        verification_token: randomToken("bp"),
        verification_challenge: `BagsPulse partner registration ${slug} @ ${new Date().toISOString()}`,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { partner: row as Partner };
  });

export const getMyPartner = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ partner: Partner | null }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("partner_registry")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return { partner: (data ?? null) as Partner | null };
  });

// Step 1: domain verification — fetch the DNS TXT record at
// _bagspulse.<host> and look for the partner's verification_token.
// We use Cloudflare's public DoH resolver (works inside the Worker runtime).
async function lookupTxt(host: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=_bagspulse.${host}&type=TXT`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { Answer?: Array<{ data?: string }> };
    return (json.Answer ?? [])
      .map((a) => (a.data ?? "").replace(/^"|"$/g, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export const verifyPartnerDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partner_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("partner_registry")
      .select("*")
      .eq("id", data.partner_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Partner not found");
    const partner = row as Partner;
    const host = hostFromUrl(partner.website);
    if (!host) throw new Error("Add a website URL first");
    if (!partner.verification_token) throw new Error("Re-register to get a verification token");

    const records = await lookupTxt(host);
    const ok = records.some((r) => r.includes(partner.verification_token!));
    if (!ok) {
      return {
        verified: false,
        instructions: {
          host: `_bagspulse.${host}`,
          type: "TXT",
          value: partner.verification_token,
        },
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("partner_registry") as any)
      .update({
        domain_verified: true,
        verified_at: partner.wallet_verified ? new Date().toISOString() : partner.verified_at,
        is_active: partner.wallet_verified, // becomes active when both checks pass
      })
      .eq("id", partner.id);

    return { verified: true };
  });

// Step 2: wallet verification — user signs `verification_challenge` with the
// fee_wallet; we verify the ed25519 signature server-side.
import nacl from "tweetnacl";
import bs58 from "bs58";

function naclVerify(message: string, signatureB58: string, publicKeyB58: string) {
  try {
    const msg = new TextEncoder().encode(message);
    const sig = bs58.decode(signatureB58);
    const pub = bs58.decode(publicKeyB58);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch {
    return false;
  }
}

export const verifyPartnerWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { partner_id: string; signature_b58: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("partner_registry")
      .select("*")
      .eq("id", data.partner_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!row) throw new Error("Partner not found");
    const partner = row as Partner;
    if (!partner.verification_challenge) throw new Error("No challenge — re-register");

    const ok = naclVerify(partner.verification_challenge, data.signature_b58, partner.fee_wallet);
    if (!ok) return { verified: false };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin.from("partner_registry") as any)
      .update({
        wallet_verified: true,
        verified_at: partner.domain_verified ? new Date().toISOString() : partner.verified_at,
        is_active: partner.domain_verified,
      })
      .eq("id", partner.id);

    return { verified: true };
  });

export const listPartners = createServerFn({ method: "GET" }).handler(async (): Promise<{ partners: Partner[] }> => {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("partner_registry")
    .select("*")
    .eq("is_active", true)
    .order("total_fees_earned", { ascending: false });
  return { partners: (data ?? []) as Partner[] };
});
