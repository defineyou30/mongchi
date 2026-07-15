import { describe, expect, it } from "vitest";

import { canAffordChatDayPass, chatDayPassCreditCost, getPremiumChatPaymentPreview, grantCreditWalletValue, mockCreditWallet } from "..";

describe("credit wallet grants", () => {
  it("adds purchased wallet value without reducing existing balances", () => {
    const grantedAt = "2026-06-24T10:00:00.000Z";
    const wallet = grantCreditWalletValue(
      mockCreditWallet,
      {
        credits: 2,
        bonusCredits: 3,
        freeChatTickets: 1
      },
      grantedAt
    );

    expect(wallet).toMatchObject({
      credits: mockCreditWallet.credits + 2,
      bonusCredits: mockCreditWallet.bonusCredits + 3,
      freeChatTickets: mockCreditWallet.freeChatTickets + 1,
      updatedAt: grantedAt
    });
  });

  it("ignores accidental negative grant values", () => {
    const wallet = grantCreditWalletValue(
      mockCreditWallet,
      {
        credits: -10,
        bonusCredits: -10,
        freeChatTickets: -10
      },
      "2026-06-24T10:00:00.000Z"
    );

    expect(wallet.credits).toBe(mockCreditWallet.credits);
    expect(wallet.bonusCredits).toBe(mockCreditWallet.bonusCredits);
    expect(wallet.freeChatTickets).toBe(mockCreditWallet.freeChatTickets);
  });

  it("previews premium chat payment priority before a reply is sent", () => {
    expect(getPremiumChatPaymentPreview(mockCreditWallet, true)).toMatchObject({
      mode: "plus_pass",
      canStart: true,
      label: "Plus pass"
    });
    expect(
      getPremiumChatPaymentPreview(
        {
          ...mockCreditWallet,
          freeChatTickets: 1,
          bonusCredits: 0,
          credits: 0
        },
        false
      )
    ).toMatchObject({
      mode: "free_ticket",
      canStart: true,
      label: "1 ticket"
    });
    expect(
      getPremiumChatPaymentPreview(
        {
          ...mockCreditWallet,
          freeChatTickets: 0,
          bonusCredits: 0,
          credits: 1
        },
        false
      )
    ).toMatchObject({
      mode: "credit",
      canStart: true,
      detail: "Next reply uses 1 credit."
    });
    expect(
      getPremiumChatPaymentPreview(
        {
          ...mockCreditWallet,
          freeChatTickets: 0,
          bonusCredits: 0,
          credits: 0
        },
        false
      )
    ).toMatchObject({
      mode: "locked",
      canStart: false
    });
  });

  it("affords a chat day pass once the spendable balance reaches the server-constant price", () => {
    expect(chatDayPassCreditCost).toBe(5);
    expect(canAffordChatDayPass({ ...mockCreditWallet, credits: 4, bonusCredits: 0 })).toBe(false);
    expect(canAffordChatDayPass({ ...mockCreditWallet, credits: 5, bonusCredits: 0 })).toBe(true);
    expect(canAffordChatDayPass({ ...mockCreditWallet, credits: 1, bonusCredits: 4 })).toBe(true);
  });
});
