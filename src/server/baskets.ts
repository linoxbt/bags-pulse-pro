// Baskets — group portfolios shared with friends. Backed by Supabase
// (baskets, basket_members, basket_tokens) with RLS enforcing membership.
// Tier limit on basket count is enforced server-side via getMyLicenseTier.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveTier } from "@/server/licenses";
import { PRICING_TIERS } from "@/lib/constants";

export type Basket = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type BasketToken = {
  id: string;
  basket_id: string;
  mint: string;
  symbol: string | null;
  name: string | null;
  image: string | null;
  target_bps: number;
  added_at: string;
};

export type BasketMember = {
  id: string;
  basket_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export const listMyBaskets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ baskets: Basket[] }> => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase.from("baskets").select("*").eq("owner_id", userId);
    const { data: memberRows } = await supabase
      .from("basket_members")
      .select("basket_id")
      .eq("user_id", userId);
    const memberIds = (memberRows ?? []).map((r) => r.basket_id);
    let memberBaskets: Basket[] = [];
    if (memberIds.length > 0) {
      const { data } = await supabase.from("baskets").select("*").in("id", memberIds);
      memberBaskets = (data ?? []) as Basket[];
    }
    const all = [...((owned ?? []) as Basket[]), ...memberBaskets];
    const dedup = Array.from(new Map(all.map((b) => [b.id, b])).values());
    dedup.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return { baskets: dedup };
  });

export const listPublicBaskets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ baskets: Basket[] }> => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("baskets")
      .select("*")
      .eq("is_public", true)
      .order("updated_at", { ascending: false })
      .limit(30);
    return { baskets: (data ?? []) as Basket[] };
  },
);

export const getBasket = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(
    async ({ data }): Promise<{ basket: Basket | null; tokens: BasketToken[]; members: BasketMember[] }> => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: basket } = await supabase.from("baskets").select("*").eq("id", data.id).maybeSingle();
      if (!basket) return { basket: null, tokens: [], members: [] };
      const [{ data: tokens }, { data: members }] = await Promise.all([
        supabase.from("basket_tokens").select("*").eq("basket_id", data.id),
        supabase.from("basket_members").select("*").eq("basket_id", data.id),
      ]);
      return {
        basket: basket as Basket,
        tokens: (tokens ?? []) as BasketToken[],
        members: (members ?? []) as BasketMember[],
      };
    },
  );

export const createBasket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; isPublic?: boolean }) => d)
  .handler(async ({ data, context }): Promise<{ basket: Basket }> => {
    const { supabase, userId } = context;

    // Hybrid gate: enforce per-tier basket limit server-side
    const tier = await resolveTier(supabase, userId);
    const tierConfig = PRICING_TIERS.find((t) => t.id === tier) ?? PRICING_TIERS[0];
    if (tierConfig.maxBaskets >= 0) {
      const { count } = await supabase
        .from("baskets")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", userId);
      if ((count ?? 0) >= tierConfig.maxBaskets) {
        throw new Error(
          `${tierConfig.name} plan allows ${tierConfig.maxBaskets} basket${tierConfig.maxBaskets === 1 ? "" : "s"}. Upgrade to add more.`,
        );
      }
    }

    const { data: row, error } = await supabase
      .from("baskets")
      .insert({
        name: data.name.slice(0, 80),
        description: data.description?.slice(0, 280) ?? null,
        is_public: data.isPublic ?? false,
        owner_id: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("basket_members").insert({
      basket_id: row.id,
      user_id: userId,
      role: "owner",
    });
    return { basket: row as Basket };
  });

export const addBasketToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { basketId: string; mint: string; symbol?: string; name?: string; image?: string; targetBps?: number }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("basket_tokens").insert({
      basket_id: data.basketId,
      mint: data.mint,
      symbol: data.symbol ?? null,
      name: data.name ?? null,
      image: data.image ?? null,
      target_bps: data.targetBps ?? 1000,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
