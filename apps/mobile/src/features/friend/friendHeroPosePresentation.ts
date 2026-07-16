import type { GeneratedAssetState } from "@mongchi/shared";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";

import type { FriendPoseCell } from "./friendProfilePresentation";

export interface HeroPoseSlide {
  cell: FriendPoseCell;
}

/**
 * Orders the pose gallery's cells for the hero pager: idle always leads (it's
 * the pet's everyday default look, so swiping should start from "how they
 * usually look"), every other owned pose follows in its existing order, then
 * locked poses trail at the end -- so the pager reads left-to-right as
 * "familiar -> still undiscovered", the same direction the old grid's reveal
 * stagger animated in.
 */
export const orderHeroPoseCells = (cells: readonly FriendPoseCell[]): FriendPoseCell[] => {
  const idleIndex = cells.findIndex((cell) => cell.state === "idle");

  if (idleIndex <= 0) {
    return [...cells];
  }

  const idleCell = cells[idleIndex]!;

  return [idleCell, ...cells.slice(0, idleIndex), ...cells.slice(idleIndex + 1)];
};

export const buildHeroPoseSlides = (cells: readonly FriendPoseCell[]): HeroPoseSlide[] => {
  const ownedCells = orderHeroPoseCells(cells).filter((cell) => cell.status === "owned");
  const fallbackCell: FriendPoseCell = { state: "idle", status: "owned", assetId: null };
  const visibleCells = ownedCells.length > 0 ? ownedCells : [fallbackCell];

  return visibleCells.map((cell) => ({ cell }));
};

/** A synthetic locked cell for the one pose the pager teases before it's owned -- see buildHeroPoseSlidesWithSleepHint. */
const lockedSleepPoseCell: FriendPoseCell = { state: "sleep", status: "locked", assetId: null };

/**
 * Same trailing slides as buildHeroPoseSlides, plus one extra locked "sleep"
 * placeholder at the very end when the pet hasn't earned that pose yet.
 * Sleep is one of the free idle/happy/sleep trio, but unlike idle/happy it
 * isn't granted at move-in -- it only appears once the owner visits during
 * the night (see deriveAmbientPetAssetState) -- so until then this gives
 * FriendHeroPoseSlider a natural spot to hint how to unlock it.
 *
 * Deliberately NOT folded into buildHeroPoseSlides itself: getShareCardPoseOptions
 * reuses that function for the share-card pose picker and must never offer a
 * pose the player doesn't actually own yet.
 */
export const buildHeroPoseSlidesWithSleepHint = (cells: readonly FriendPoseCell[]): HeroPoseSlide[] => {
  const ownedSlides = buildHeroPoseSlides(cells);

  if (ownedSlides.some((slide) => slide.cell.state === "sleep")) {
    return ownedSlides;
  }

  return [...ownedSlides, { cell: lockedSleepPoseCell }];
};

const paidPoseLabelByState = {
  base: { "en-US": "Base pose", "ko-KR": "기본 포즈", "ja-JP": "ベースポーズ", "zh-TW": "基本姿勢", "de-DE": "Grundpose", "fr-FR": "Pose de base", "pt-BR": "Pose base", "es-MX": "Pose base" },
  play: { "en-US": "Playful", "ko-KR": "신나게", "ja-JP": "あそびたい", "zh-TW": "愛玩", "de-DE": "Verspielt", "fr-FR": "Joueur", "pt-BR": "Brincalhão", "es-MX": "Juguetón" },
  hungry: { "en-US": "Hungry", "ko-KR": "배고파", "ja-JP": "おなかすいた", "zh-TW": "肚子餓", "de-DE": "Hungrig", "fr-FR": "Affamé", "pt-BR": "Com fome", "es-MX": "Con hambre" },
  walk_return: { "en-US": "Walk home", "ko-KR": "산책 다녀와", "ja-JP": "お散歩から帰宅", "zh-TW": "散步回家", "de-DE": "Vom Spaziergang zurück", "fr-FR": "Retour de balade", "pt-BR": "De volta do passeio", "es-MX": "De vuelta del paseo" },
  treat_reaction: { "en-US": "Treat joy", "ko-KR": "간식 최고", "ja-JP": "おやつ最高", "zh-TW": "點心好開心", "de-DE": "Leckerli-Freude", "fr-FR": "Joie du goûter", "pt-BR": "Alegria do petisco", "es-MX": "Alegría por el premio" },
  chat_portrait: { "en-US": "Chat close-up", "ko-KR": "대화 가까이", "ja-JP": "おしゃべりアップ", "zh-TW": "聊天特寫", "de-DE": "Plaudern ganz nah", "fr-FR": "Gros plan papote", "pt-BR": "Conversa de pertinho", "es-MX": "Charla de cerca" },
  curious: { "en-US": "Curious", "ko-KR": "궁금해", "ja-JP": "なになに？", "zh-TW": "好奇", "de-DE": "Neugierig", "fr-FR": "Curieux", "pt-BR": "Curioso", "es-MX": "Curioso" },
  celebrate: { "en-US": "Celebrate", "ko-KR": "축하해", "ja-JP": "お祝い", "zh-TW": "慶祝", "de-DE": "Feierlaune", "fr-FR": "Célébration", "pt-BR": "Comemorando", "es-MX": "Celebración" },
  garden_help: { "en-US": "Garden helper", "ko-KR": "정원 도우미", "ja-JP": "お庭のお手伝い", "zh-TW": "花園小幫手", "de-DE": "Gartenhelfer", "fr-FR": "Aide au jardin", "pt-BR": "Ajudante do jardim", "es-MX": "Ayudante del jardín" },
  seasonal: { "en-US": "Seasonal", "ko-KR": "계절 느낌", "ja-JP": "季節の装い", "zh-TW": "季節造型", "de-DE": "Jahreszeitlich", "fr-FR": "De saison", "pt-BR": "Clima da estação", "es-MX": "De temporada" },
  sad: { "en-US": "Needs comfort", "ko-KR": "위로가 필요해", "ja-JP": "なぐさめて", "zh-TW": "想被安慰", "de-DE": "Braucht Trost", "fr-FR": "Besoin de réconfort", "pt-BR": "Quer carinho", "es-MX": "Necesita consuelo" },
  sick: { "en-US": "Under the weather", "ko-KR": "기운이 없어", "ja-JP": "ちょっと元気がない", "zh-TW": "有點不舒服", "de-DE": "Etwas angeschlagen", "fr-FR": "Un peu patraque", "pt-BR": "Meio indisposto", "es-MX": "Un poco indispuesto" },
  messy: { "en-US": "A little messy", "ko-KR": "조금 꼬질꼬질", "ja-JP": "ちょっぴり汚れた", "zh-TW": "有點髒亂", "de-DE": "Ein bisschen schmutzig", "fr-FR": "Un peu décoiffé", "pt-BR": "Um pouco bagunçado", "es-MX": "Un poco desarreglado" }
} as const satisfies Record<Exclude<GeneratedAssetState, "idle" | "happy" | "sleep">, LocalizedText>;

export const getHeroPoseLabel = (state: GeneratedAssetState, locale: AppLocale = "en-US"): string => {
  const resources = getResourcesForLocale(locale);

  switch (state) {
    case "idle":
      return resources.friend.pose.labels.everyday;
    case "happy":
      return resources.friend.pose.labels.happy;
    case "sleep":
      return resources.friend.pose.labels.sleepy;
    default:
      return getLocalizedText(locale, paidPoseLabelByState[state]);
  }
};
