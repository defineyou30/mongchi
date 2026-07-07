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

export const starterCreditItemPrices: readonly CreditItemPrice[] = [
  { itemId: "item_treat_plate_biscuit", creditCost: 2 },
  { itemId: "item_bone_biscuit", creditCost: 2 },
  { itemId: "item_salmon_bites", creditCost: 2 },
  { itemId: "item_chicken_jerky", creditCost: 2 },
  { itemId: "item_pumpkin_cookie", creditCost: 3 },
  { itemId: "item_berry_yogurt", creditCost: 4 },
  { itemId: "item_sweet_potato_chew", creditCost: 2 },
  { itemId: "item_tuna_crunch", creditCost: 3 },
  { itemId: "item_duck_biscuit", creditCost: 4 },
  { itemId: "item_cheese_puff", creditCost: 3 },
  { itemId: "item_apple_biscuit", creditCost: 2 },
  { itemId: "item_milk_pup_cup", creditCost: 5 },
  { itemId: "item_plush_toy_buddy", creditCost: 3 },
  { itemId: "item_cushion_rose", creditCost: 5 },
  // item_stepping_stone_path is retired from the mobile shop's UI (its
  // category, "path", is filtered out of every mobile shop tab — see
  // ShopPreviewScreen.tsx's getItemShopCategory) but keeps a price here
  // because services/api's purchaseInventoryItem tests exercise buying it
  // for 3 credits. See mockData.ts's note beside the catalog entry.
  { itemId: "item_stepping_stone_path", creditCost: 3 }
];

export const getCreditItemPrice = (itemId: ItemId): CreditItemPrice | null =>
  starterCreditItemPrices.find((price) => price.itemId === itemId) ?? null;

export const canSpendPremiumChatTurn = (wallet: CreditWallet, creditCost: number = 1): boolean =>
  wallet.freeChatTickets > 0 || getSpendableCreditBalance(wallet) >= creditCost;

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
