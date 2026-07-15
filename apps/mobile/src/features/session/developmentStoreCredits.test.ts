import { describe, expect, it } from "vitest";

import { mockCreditWallet } from "@mongchi/shared";

import { getDevelopmentStoreCreditPresentation, getExpressionPackValidationWallet } from "./developmentStoreCredits";

describe("development store credit presentation", () => {
  it("uses the development wallet when no server wallet is connected", () => {
    expect(
      getDevelopmentStoreCreditPresentation({
        developmentCreditBalance: 9999,
        devStoreUnlocked: true,
        hasServerWallet: false,
        serverCreditBalance: 0,
        spendableCreditBalance: 3
      })
    ).toEqual({
      creditBalance: 9999,
      devStoreCreditsAvailable: true,
      expressionPackCreditBalance: 9999
    });
  });

  it("removes local bonus credits from server-backed purchase validation", () => {
    expect(
      getExpressionPackValidationWallet(
        {
          ...mockCreditWallet,
          bonusCredits: 25,
          credits: 0
        },
        true
      )
    ).toMatchObject({
      bonusCredits: 0,
      credits: 0
    });
  });

  it("keeps local bonus credits for the no-server fallback", () => {
    expect(getExpressionPackValidationWallet(mockCreditWallet, false)).toEqual(mockCreditWallet);
  });

  it("excludes local bonus credits from a server-backed expression pack balance", () => {
    expect(
      getDevelopmentStoreCreditPresentation({
        developmentCreditBalance: 9999,
        devStoreUnlocked: true,
        hasServerWallet: true,
        serverCreditBalance: 0,
        spendableCreditBalance: 25
      })
    ).toEqual({
      creditBalance: 0,
      devStoreCreditsAvailable: false,
      expressionPackCreditBalance: 0
    });
  });

  it("uses only server credits for a server-backed expression pack", () => {
    expect(
      getDevelopmentStoreCreditPresentation({
        developmentCreditBalance: 9999,
        devStoreUnlocked: true,
        hasServerWallet: true,
        serverCreditBalance: 25,
        spendableCreditBalance: 50
      })
    ).toEqual({
      creditBalance: 25,
      devStoreCreditsAvailable: false,
      expressionPackCreditBalance: 25
    });
  });

  it("never exposes development credits in a release build", () => {
    expect(
      getDevelopmentStoreCreditPresentation({
        developmentCreditBalance: 9999,
        devStoreUnlocked: false,
        hasServerWallet: false,
        serverCreditBalance: 0,
        spendableCreditBalance: 3
      })
    ).toEqual({
      creditBalance: 3,
      devStoreCreditsAvailable: false,
      expressionPackCreditBalance: 3
    });
  });
});
