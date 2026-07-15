-- Live shop server path: server-authoritative credit purchases for
-- consumable/decor catalog items (treats, drinks, toys, beds) and theme
-- bundles. Mirrors 0019_walk_early_return.sql's pattern exactly --
-- authenticated direct-call RPCs keyed off auth.uid(), no Edge Function,
-- since both are simple flat-price purchases with no server-side timers to
-- coordinate (unlike the chat day pass / expression pack flows, which need
-- service_role because they also gate on non-credit server state).
--
-- Inventory/theme ownership stays client-local (packages/shared's
-- prototypeSession.ts) -- these RPCs own only the credit debit + ledger
-- entry. The mobile client grants the local item/theme only after the RPC
-- reports 'purchased', then corrects wallet.credits to the returned
-- authoritative balance instead of also deducting locally (see
-- apps/mobile/src/features/session/supabaseShopSession.ts and
-- TerrariumSessionProvider's purchaseCatalogItem/purchaseThemeBundle).
--
-- Prices are hardcoded below rather than ever trusting a client-supplied
-- price -- see packages/shared/src/domain/wallet.ts's starterCreditItemPrices
-- (treat/drink = 2, toy/bed = 5 credits, 2026-07 pricing pass) and
-- packages/shared/src/domain/themeBundles.ts's themeBundles (18 credits
-- flat, all four bundles). item_stepping_stone_path is deliberately left out
-- of the item price map below even though wallet.ts still prices it at 3 --
-- per wallet.ts's own comment, that item is retired from the mobile shop's
-- UI (ShopPreviewScreen filters its "path" category out of every shop tab)
-- and the id/price pair only exists there for services/api's legacy
-- purchaseInventoryItem tests, so there is no live-shop purchase flow that
-- should ever be able to spend credits on it -- it falls through to
-- 'unknown_item' here.
--
-- Reasons: 'consume_theme_bundle' is already reserved in 0004_credit_ledger's
-- credit_ledger.reason doc comment (never previously implemented -- this
-- migration is its first real consumer). 'consume_shop_item' is a new reason
-- for the generic item purchase, not yet listed in that comment since 0004
-- already landed and is never edited after the fact.

BEGIN;

-- ---------------------------------------------------------------------------
-- RPC: purchase_inventory_item
--
-- Buys one unit of a credit-store catalog item (treats/drinks = 2 credits,
-- toys/beds = 5 credits). Idempotent by (user, 'consume_shop_item',
-- 'inventory_item', p_request_id) via consume_credits -- a retried request
-- with the same p_request_id never charges twice.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purchase_inventory_item(
  p_item_id    TEXT,
  p_request_id TEXT
)
RETURNS TABLE (
  outcome TEXT,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance INTEGER;
  v_cost INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'purchase_inventory_item: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR btrim(p_request_id) = '' OR char_length(p_request_id) > 128
    OR p_item_id IS NULL OR btrim(p_item_id) = '' THEN
    RAISE EXCEPTION 'purchase_inventory_item: invalid input' USING ERRCODE = '22023';
  END IF;

  -- Server-authoritative price map (2026-07 pricing pass) -- see this
  -- migration's header comment for the treat/drink/toy/bed rule and why
  -- item_stepping_stone_path has no entry here.
  v_cost := CASE p_item_id
    -- treats & drinks (2 credits)
    WHEN 'item_treat_plate_biscuit' THEN 2
    WHEN 'item_bone_biscuit' THEN 2
    WHEN 'item_salmon_bites' THEN 2
    WHEN 'item_chicken_jerky' THEN 2
    WHEN 'item_pumpkin_cookie' THEN 2
    WHEN 'item_berry_yogurt' THEN 2
    WHEN 'item_sweet_potato_chew' THEN 2
    WHEN 'item_tuna_crunch' THEN 2
    WHEN 'item_duck_biscuit' THEN 2
    WHEN 'item_cheese_puff' THEN 2
    WHEN 'item_apple_biscuit' THEN 2
    WHEN 'item_honey_paw_wafer' THEN 2
    WHEN 'item_milk_pup_cup' THEN 2
    WHEN 'item_dewdrop_water' THEN 2
    WHEN 'item_apple_sip' THEN 2
    WHEN 'item_berry_milk' THEN 2
    WHEN 'item_pumpkin_cream' THEN 2
    WHEN 'item_blueberry_smoothie' THEN 2
    WHEN 'item_carrot_cooler' THEN 2
    WHEN 'item_sweet_potato_shake' THEN 2
    WHEN 'item_salmon_broth' THEN 2
    WHEN 'item_tuna_broth' THEN 2
    WHEN 'item_coconut_splash' THEN 2
    WHEN 'item_pear_nectar' THEN 2
    -- toys & beds (5 credits)
    WHEN 'item_plush_toy_buddy' THEN 5
    WHEN 'item_rope_ring_mint' THEN 5
    WHEN 'item_star_squeaker_sunny' THEN 5
    WHEN 'item_ribbon_wand_garden' THEN 5
    WHEN 'item_clover_puzzle_mint' THEN 5
    WHEN 'item_moon_frisbee' THEN 5
    WHEN 'item_bell_roller' THEN 5
    WHEN 'item_feather_teaser' THEN 5
    WHEN 'item_snuffle_mat' THEN 5
    WHEN 'item_wobble_treat_ball' THEN 5
    WHEN 'item_crinkle_leaf' THEN 5
    WHEN 'item_sunbeam_spinner' THEN 5
    WHEN 'item_cloud_cushion_sky' THEN 5
    WHEN 'item_cushion_rose' THEN 5
    WHEN 'item_clover_nap_mat' THEN 5
    WHEN 'item_moon_pillow' THEN 5
    WHEN 'item_star_blanket' THEN 5
    WHEN 'item_cozy_basket' THEN 5
    WHEN 'item_window_perch' THEN 5
    WHEN 'item_patchwork_rug' THEN 5
    WHEN 'item_sleep_tent' THEN 5
    WHEN 'item_donut_bed' THEN 5
    WHEN 'item_garden_hammock' THEN 5
    WHEN 'item_lantern_nest' THEN 5
    ELSE NULL
  END;

  IF v_cost IS NULL THEN
    RETURN QUERY SELECT 'unknown_item'::TEXT,
      COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0);
    RETURN;
  END IF;

  -- Serialize retries for this exact request before consume_credits checks
  -- its ledger idempotency key, same reasoning as
  -- 0019_walk_early_return.sql's advisory lock.
  PERFORM pg_advisory_xact_lock(hashtext('shop-item:' || v_user::TEXT || ':' || p_request_id));

  v_balance := public.consume_credits(
    v_user,
    v_cost,
    'consume_shop_item',
    'inventory_item',
    p_request_id,
    jsonb_build_object('item_id', p_item_id, 'credit_cost', v_cost)
  );

  IF v_balance = -1 THEN
    SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0)
      INTO v_balance;

    RETURN QUERY SELECT 'insufficient_credits'::TEXT, v_balance;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'purchased'::TEXT, v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_inventory_item(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_inventory_item(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: purchase_theme_bundle
--
-- Buys a background theme bundle (flat 18 credits, packages/shared's
-- themeBundles). Re-purchase prevention for an already-owned theme is the
-- client's responsibility -- ShopPreviewScreen/TerrariumSessionProvider's
-- applyTheme re-applies an owned theme for free and never calls this RPC for
-- it, and this RPC has no visibility into the client-local
-- inventory.ownedThemeIds to refuse a re-buy itself. Idempotency for retries
-- of the *same* purchase attempt is still guaranteed by consume_credits'
-- (user, reason, ref_type, ref_id) uniqueness on p_request_id, same as every
-- other RPC here.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purchase_theme_bundle(
  p_bundle_id  TEXT,
  p_request_id TEXT
)
RETURNS TABLE (
  outcome TEXT,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance INTEGER;
  v_cost CONSTANT INTEGER := 18;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'purchase_theme_bundle: authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_request_id IS NULL OR btrim(p_request_id) = '' OR char_length(p_request_id) > 128
    OR p_bundle_id IS NULL OR btrim(p_bundle_id) = '' THEN
    RAISE EXCEPTION 'purchase_theme_bundle: invalid input' USING ERRCODE = '22023';
  END IF;

  -- Server-authoritative bundle whitelist -- packages/shared/src/domain/
  -- themeBundles.ts's themeBundles, all priced at 18 credits flat.
  IF p_bundle_id NOT IN (
    'bundle_fairy_garden',
    'bundle_seaside_cove',
    'bundle_autumn_woods',
    'bundle_winter_lights'
  ) THEN
    RETURN QUERY SELECT 'unknown_item'::TEXT,
      COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0);
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('shop-theme:' || v_user::TEXT || ':' || p_request_id));

  v_balance := public.consume_credits(
    v_user,
    v_cost,
    'consume_theme_bundle',
    'theme_bundle',
    p_request_id,
    jsonb_build_object('bundle_id', p_bundle_id, 'credit_cost', v_cost)
  );

  IF v_balance = -1 THEN
    SELECT COALESCE((SELECT wallet.balance FROM public.credit_wallets wallet WHERE wallet.user_id = v_user), 0)
      INTO v_balance;

    RETURN QUERY SELECT 'insufficient_credits'::TEXT, v_balance;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'purchased'::TEXT, v_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_theme_bundle(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_theme_bundle(TEXT, TEXT) TO authenticated;

COMMIT;
