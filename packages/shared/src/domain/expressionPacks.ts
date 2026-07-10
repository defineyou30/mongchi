import type { GeneratedAssetState } from "./assets";

/**
 * A purchasable expression pack: a small set of additional generated-asset
 * states beyond the free idle/happy/sleep trio. Buying a pack starts a
 * server-side generation job scoped to just its states (see
 * supabaseGenerationSession.ts's expression-pack start flow) — once that job
 * completes, the new assets are merged into acceptedAssets and the reaction
 * engine (selectGeneratedAssetForReaction) picks them up automatically
 * whenever a matching reaction fires. Kept as an array so future packs can be
 * added without any shape change.
 */
export interface ExpressionPack {
  id: string;
  nameEn: string;
  nameKo: string;
  descriptionEn: string;
  descriptionKo: string;
  /** Generated-asset states this pack unlocks. Never overlaps the free idle/happy/sleep trio. */
  states: readonly GeneratedAssetState[];
  creditCost: number;
}

export const EXPRESSION_PACK_SIZE = 3;

/**
 * Vertical-slice launch pack: the three states a companion reaches most often
 * through everyday play (see petExpression.ts's deriveAmbientPetAssetState
 * for hungry/sleep priority, and assetStateForReactionCategory for
 * curious/hungry's reaction-category mappings) -- these are the expressions
 * an owner will actually see fire soonest after unlocking, rather than a rare
 * one like celebrate or garden_help.
 */
export const expressionPacks: ExpressionPack[] = [
  {
    id: "pack-everyday-moments",
    nameEn: "Everyday Moments",
    nameKo: "일상의 순간들",
    descriptionEn: "A few more everyday looks — curious, playful, and a little hungry.",
    descriptionKo: "궁금해하고, 신나게 놀고, 배고파하는 모습까지 — 일상 속 표정을 더 만나보세요.",
    states: ["curious", "play", "hungry"],
    creditCost: 12
  },
  {
    id: "pack-care-reactions",
    nameEn: "Care Reactions",
    nameKo: "돌봄 리액션",
    descriptionEn: "Richer looks for treats, walks, and heart-to-heart chats.",
    descriptionKo: "간식, 산책, 대화 순간에 더 잘 어울리는 리액션을 열어요.",
    states: ["treat_reaction", "walk_return", "chat_portrait"],
    creditCost: 12
  },
  {
    id: "pack-special-days",
    nameEn: "Special Days",
    nameKo: "특별한 날",
    descriptionEn: "Celebration, garden-helper, and seasonal looks for milestone days.",
    descriptionKo: "기념일, 정원 돌보기, 계절 분위기에 맞는 특별한 모습을 열어요.",
    states: ["celebrate", "garden_help", "seasonal"],
    creditCost: 12
  }
];

export const getExpressionPackById = (packId: string): ExpressionPack | null =>
  expressionPacks.find((pack) => pack.id === packId) ?? null;

/** True once every state in the pack has a matching generated asset already accepted. */
export const isExpressionPackUnlocked = (pack: ExpressionPack, acceptedAssetStates: readonly GeneratedAssetState[]): boolean =>
  pack.states.every((state) => acceptedAssetStates.includes(state));
