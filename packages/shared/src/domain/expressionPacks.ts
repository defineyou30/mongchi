import type { GeneratedAssetState } from "./assets";

export interface ExpressionPackPoseDetail {
  state: GeneratedAssetState;
  nameEn: string;
  nameKo: string;
  usageEn: string;
  usageKo: string;
}

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
  poseDetails: readonly ExpressionPackPoseDetail[];
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
    poseDetails: [
      { state: "curious", nameEn: "Curious", nameKo: "궁금해", usageEn: "When something catches their eye", usageKo: "무언가 눈길을 끌 때" },
      { state: "play", nameEn: "Playful", nameKo: "신나게", usageEn: "During playtime", usageKo: "함께 놀아줄 때" },
      { state: "hungry", nameEn: "Hungry", nameKo: "배고파", usageEn: "When the bowl feels empty", usageKo: "배가 고파질 때" }
    ],
    creditCost: 12
  },
  {
    id: "pack-care-reactions",
    nameEn: "Care Reactions",
    nameKo: "돌봄 리액션",
    descriptionEn: "Richer looks for treats, walks, and heart-to-heart chats.",
    descriptionKo: "간식, 산책, 대화 순간에 더 잘 어울리는 리액션을 열어요.",
    states: ["treat_reaction", "walk_return", "chat_portrait"],
    poseDetails: [
      { state: "treat_reaction", nameEn: "Treat joy", nameKo: "간식 최고", usageEn: "After a favorite treat", usageKo: "좋아하는 간식을 먹은 뒤" },
      { state: "walk_return", nameEn: "Walk home", nameKo: "산책 다녀와", usageEn: "Coming back from a walk", usageKo: "산책에서 돌아올 때" },
      { state: "chat_portrait", nameEn: "Chat close-up", nameKo: "대화 가까이", usageEn: "In heart-to-heart chats", usageKo: "마음을 나누는 대화에서" }
    ],
    creditCost: 12
  },
  {
    id: "pack-special-days",
    nameEn: "Special Days",
    nameKo: "특별한 날",
    descriptionEn: "Celebration, garden-helper, and seasonal looks for milestone days.",
    descriptionKo: "기념일, 정원 돌보기, 계절 분위기에 맞는 특별한 모습을 열어요.",
    states: ["celebrate", "garden_help", "seasonal"],
    poseDetails: [
      { state: "celebrate", nameEn: "Celebrate", nameKo: "축하해", usageEn: "Bond levels and milestones", usageKo: "관계 레벨과 기념일에" },
      { state: "garden_help", nameEn: "Garden helper", nameKo: "정원 도우미", usageEn: "While tending the garden", usageKo: "정원을 돌볼 때" },
      { state: "seasonal", nameEn: "Seasonal", nameKo: "계절 느낌", usageEn: "Seasonal garden moments", usageKo: "계절 이벤트에서" }
    ],
    creditCost: 12
  },
  {
    id: "pack-tender-care",
    nameEn: "Tender Care",
    nameKo: "다정한 돌봄",
    descriptionEn: "Gentler looks for the moments when your companion needs extra care.",
    descriptionKo: "조금 더 세심한 돌봄이 필요한 순간을 위한 표정을 열어요.",
    states: ["sad", "sick", "messy"],
    poseDetails: [
      { state: "sad", nameEn: "Needs comfort", nameKo: "위로가 필요해", usageEn: "When comfort is needed", usageKo: "위로가 필요한 순간에" },
      { state: "sick", nameEn: "Under the weather", nameKo: "기운이 없어", usageEn: "On low-energy care days", usageKo: "기운이 없는 돌봄 날에" },
      { state: "messy", nameEn: "A little messy", nameKo: "조금 꼬질꼬질", usageEn: "After muddy adventures", usageKo: "신나게 뛰놀고 난 뒤" }
    ],
    creditCost: 12
  }
];

export const getExpressionPackById = (packId: string): ExpressionPack | null =>
  expressionPacks.find((pack) => pack.id === packId) ?? null;

/** True once every state in the pack has a matching generated asset already accepted. */
export const isExpressionPackUnlocked = (pack: ExpressionPack, acceptedAssetStates: readonly GeneratedAssetState[]): boolean =>
  pack.states.every((state) => acceptedAssetStates.includes(state));
