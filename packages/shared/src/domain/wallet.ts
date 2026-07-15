import type { ISODateTime, ItemId, UserId } from "./common";

export interface CreditWallet {
  userId: UserId;
  credits: number;
  bonusCredits: number;
  freeChatTickets: number;
  updatedAt: ISODateTime;
}

export interface CreditWalletSpendBreakdown {
  freeChatTicketsSpent: number;
  bonusCreditsSpent: number;
  creditsSpent: number;
}

export interface CreditWalletGrant {
  credits?: number;
  bonusCredits?: number;
  freeChatTickets?: number;
}

export interface CreditItemPrice {
  itemId: ItemId;
  creditCost: number;
  purchaseLimit?: number;
}

export type PremiumChatPaymentMode = "plus_pass" | "free_ticket" | "credit" | "locked";

export interface PremiumChatPaymentPreview {
  mode: PremiumChatPaymentMode;
  canStart: boolean;
  label: string;
  detail: string;
  creditCost: number;
}

export type CreditWalletSpendResult =
  | {
      ok: true;
      wallet: CreditWallet;
      spend: CreditWalletSpendBreakdown;
    }
  | {
      ok: false;
      reason: "insufficient_balance";
    };

export const getSpendableCreditBalance = (wallet: CreditWallet): number =>
  Math.max(0, wallet.credits + wallet.bonusCredits);

// Flat per-category pricing (2026-07 pricing pass): treats and drinks are
// both 2 credits, toys and beds (rest) are both 5 credits, regardless of
// rarity/premium flag — a single easy-to-remember price per category rather
// than per-item variance. item_stepping_stone_path is the one exception
// (see its own comment below).
const TREAT_OR_DRINK_CREDIT_COST = 2;
const TOY_OR_BED_CREDIT_COST = 5;

export const starterCreditItemPrices: readonly CreditItemPrice[] = [
  { itemId: "item_treat_plate_biscuit", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_bone_biscuit", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_salmon_bites", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_chicken_jerky", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_pumpkin_cookie", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_berry_yogurt", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_sweet_potato_chew", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_tuna_crunch", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_duck_biscuit", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_cheese_puff", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_apple_biscuit", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_honey_paw_wafer", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_milk_pup_cup", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_dewdrop_water", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_apple_sip", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_berry_milk", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_pumpkin_cream", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_blueberry_smoothie", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_carrot_cooler", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_sweet_potato_shake", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_salmon_broth", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_tuna_broth", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_coconut_splash", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_pear_nectar", creditCost: TREAT_OR_DRINK_CREDIT_COST },
  { itemId: "item_plush_toy_buddy", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_rope_ring_mint", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_star_squeaker_sunny", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_ribbon_wand_garden", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_clover_puzzle_mint", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_moon_frisbee", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_bell_roller", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_feather_teaser", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_snuffle_mat", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_wobble_treat_ball", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_crinkle_leaf", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_sunbeam_spinner", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_cloud_cushion_sky", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_cushion_rose", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_clover_nap_mat", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_moon_pillow", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_star_blanket", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_cozy_basket", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_window_perch", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_patchwork_rug", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_sleep_tent", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_donut_bed", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_garden_hammock", creditCost: TOY_OR_BED_CREDIT_COST },
  { itemId: "item_lantern_nest", creditCost: TOY_OR_BED_CREDIT_COST },
  // item_stepping_stone_path is retired from the mobile shop's UI (its
  // category, "path", is filtered out of every mobile shop tab — see
  // ShopPreviewScreen.tsx's getItemShopCategory) and sits outside the
  // treat/drink/toy/bed pricing pass above -- it keeps its old price here
  // only because services/api's purchaseInventoryItem tests exercise buying
  // it for 3 credits. See mockData.ts's note beside the catalog entry.
  { itemId: "item_stepping_stone_path", creditCost: 3 }
];

export const getCreditItemPrice = (itemId: ItemId): CreditItemPrice | null =>
  starterCreditItemPrices.find((price) => price.itemId === itemId) ?? null;

export const canSpendPremiumChatTurn = (wallet: CreditWallet, creditCost: number = 1): boolean =>
  wallet.freeChatTickets > 0 || getSpendableCreditBalance(wallet) >= creditCost;

/**
 * Server-constant price of a chat "day pass" (Chat Live BM decision:
 * subscription-free single credit economy + a one-off "chatty day pass") --
 * mirrors purchase_chat_day_pass's v_cost constant, originally defined in
 * 0018_chat_day_pass.sql and repriced by 0020_chat_day_pass_price_increase.sql
 * (CREATE OR REPLACE, 0018 itself is untouched). The server always owns the
 * real charge; this is exported purely so the mobile gate UI can decide
 * whether to offer the purchase (and label its price) without inventing its
 * own copy of the number.
 */
export const chatDayPassCreditCost = 5;

export const canAffordChatDayPass = (wallet: CreditWallet): boolean =>
  getSpendableCreditBalance(wallet) >= chatDayPassCreditCost;

export const getPremiumChatPaymentPreview = (
  wallet: CreditWallet,
  hasPremiumChatEntitlement: boolean,
  creditCost: number = 1
): PremiumChatPaymentPreview => {
  if (hasPremiumChatEntitlement) {
    return {
      mode: "plus_pass",
      canStart: true,
      label: "Plus pass",
      detail: "Long chat is included.",
      creditCost
    };
  }

  if (wallet.freeChatTickets > 0) {
    return {
      mode: "free_ticket",
      canStart: true,
      label: `${wallet.freeChatTickets} ticket${wallet.freeChatTickets === 1 ? "" : "s"}`,
      detail: "Next reply uses 1 ticket.",
      creditCost
    };
  }

  const creditBalance = getSpendableCreditBalance(wallet);

  if (creditBalance >= creditCost) {
    return {
      mode: "credit",
      canStart: true,
      label: `${creditBalance} credit${creditBalance === 1 ? "" : "s"}`,
      detail: `Next reply uses ${creditCost} credit${creditCost === 1 ? "" : "s"}.`,
      creditCost
    };
  }

  return {
    mode: "locked",
    canStart: false,
    label: "No chat credit",
    detail: "Use a ticket, credit, or Plus pass.",
    creditCost
  };
};

export const spendPremiumChatTurn = (
  wallet: CreditWallet,
  spentAt: ISODateTime,
  creditCost: number = 1
): CreditWalletSpendResult => {
  if (wallet.freeChatTickets > 0) {
    return {
      ok: true,
      wallet: {
        ...wallet,
        freeChatTickets: wallet.freeChatTickets - 1,
        updatedAt: spentAt
      },
      spend: {
        freeChatTicketsSpent: 1,
        bonusCreditsSpent: 0,
        creditsSpent: 0
      }
    };
  }

  if (getSpendableCreditBalance(wallet) < creditCost) {
    return {
      ok: false,
      reason: "insufficient_balance"
    };
  }

  const bonusCreditsSpent = Math.min(wallet.bonusCredits, creditCost);
  const creditsSpent = creditCost - bonusCreditsSpent;

  return {
    ok: true,
    wallet: {
      ...wallet,
      bonusCredits: wallet.bonusCredits - bonusCreditsSpent,
      credits: wallet.credits - creditsSpent,
      updatedAt: spentAt
    },
    spend: {
      freeChatTicketsSpent: 0,
      bonusCreditsSpent,
      creditsSpent
    }
  };
};

export const canSpendCredits = (wallet: CreditWallet, creditCost: number): boolean =>
  getSpendableCreditBalance(wallet) >= creditCost;

export const spendCredits = (
  wallet: CreditWallet,
  creditCost: number,
  spentAt: ISODateTime
): CreditWalletSpendResult => {
  if (!canSpendCredits(wallet, creditCost)) {
    return {
      ok: false,
      reason: "insufficient_balance"
    };
  }

  const bonusCreditsSpent = Math.min(wallet.bonusCredits, creditCost);
  const creditsSpent = creditCost - bonusCreditsSpent;

  return {
    ok: true,
    wallet: {
      ...wallet,
      bonusCredits: wallet.bonusCredits - bonusCreditsSpent,
      credits: wallet.credits - creditsSpent,
      updatedAt: spentAt
    },
    spend: {
      freeChatTicketsSpent: 0,
      bonusCreditsSpent,
      creditsSpent
    }
  };
};

export const grantCreditWalletValue = (
  wallet: CreditWallet,
  grant: CreditWalletGrant,
  grantedAt: ISODateTime
): CreditWallet => ({
  ...wallet,
  credits: wallet.credits + Math.max(0, grant.credits ?? 0),
  bonusCredits: wallet.bonusCredits + Math.max(0, grant.bonusCredits ?? 0),
  freeChatTickets: wallet.freeChatTickets + Math.max(0, grant.freeChatTickets ?? 0),
  updatedAt: grantedAt
});
