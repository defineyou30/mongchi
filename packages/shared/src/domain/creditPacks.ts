export const STARTER_CREDIT_GRANT = 5;

export const creditPacks = [
  { productId: "credit_pack_20", credits: 20, tier: "small" },
  { productId: "credit_pack_60", credits: 60, tier: "popular" },
  { productId: "credit_pack_150", credits: 150, tier: "large" }
] as const;

export type CreditPack = (typeof creditPacks)[number];
export type CreditPackTier = CreditPack["tier"];

export const getCreditPackByProductId = (productId: string): CreditPack | null => creditPacks.find((pack) => pack.productId === productId) ?? null;
