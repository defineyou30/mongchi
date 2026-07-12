import type { CreditWallet } from "@mongchi/shared";

interface DevelopmentStoreCreditPresentationInput {
  readonly developmentCreditBalance: number;
  readonly devStoreUnlocked: boolean;
  readonly hasServerWallet: boolean;
  readonly serverCreditBalance: number;
  readonly spendableCreditBalance: number;
}

interface DevelopmentStoreCreditPresentation {
  readonly creditBalance: number;
  readonly devStoreCreditsAvailable: boolean;
  readonly expressionPackCreditBalance: number;
}

export const getDevelopmentStoreCreditPresentation = ({
  developmentCreditBalance,
  devStoreUnlocked,
  hasServerWallet,
  serverCreditBalance,
  spendableCreditBalance
}: DevelopmentStoreCreditPresentationInput): DevelopmentStoreCreditPresentation => {
  const devStoreCreditsAvailable = devStoreUnlocked && !hasServerWallet;
  const localCreditBalance = devStoreCreditsAvailable
    ? Math.max(developmentCreditBalance, spendableCreditBalance)
    : spendableCreditBalance;

  return {
    creditBalance: localCreditBalance,
    devStoreCreditsAvailable,
    expressionPackCreditBalance: hasServerWallet ? Math.max(0, serverCreditBalance) : localCreditBalance
  };
};

export const getExpressionPackValidationWallet = (wallet: CreditWallet, hasServerWallet: boolean): CreditWallet =>
  hasServerWallet
    ? {
        ...wallet,
        bonusCredits: 0
      }
    : wallet;
