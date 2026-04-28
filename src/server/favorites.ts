// User swap-picker favorites (watchlist). Backed by public.swap_favorites.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SwapFavorite = {
  mint: string;
  symbol: string | null;
  name: string | null;
  logo_uri: string | null;
  decimals: number | null;
};

export const listSwapFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ favorites: SwapFavorite[] }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("swap_favorites")
      .select("mint,symbol,name,logo_uri,decimals")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return { favorites: (data ?? []) as SwapFavorite[] };
  });

export const addSwapFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      mint: string;
      symbol?: string;
      name?: string;
      logoUri?: string;
      decimals?: number;
    }) => d,
  )
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("swap_favorites").upsert(
      {
        user_id: userId,
        mint: data.mint,
        symbol: data.symbol ?? null,
        name: data.name ?? null,
        logo_uri: data.logoUri ?? null,
        decimals: data.decimals ?? null,
      },
      { onConflict: "user_id,mint" },
    );
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const removeSwapFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { mint: string }) => d)
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("swap_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("mint", data.mint);
    if (error) throw new Error(error.message);
    return { success: true };
  });
