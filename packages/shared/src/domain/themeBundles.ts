import type { ItemId } from "./common";

/**
 * The always-free default garden backdrop -- every session owns this from
 * the start (see createInitialPrototypeSession's ownedThemeIds seed) and it
 * never appears in themeBundles below, since there is nothing to purchase.
 * Selecting it (applyPrototypeTheme) never charges credits.
 */
export const DEFAULT_THEME_ID: ItemId = "theme-default-garden";

/**
 * Theme bundles sell a background-only garden theme — a full backdrop swap,
 * not a bundle of placeable decor. The home garden background is a finished
 * illustration on its own, so purchasing a theme simply unlocks a new
 * backdrop to apply instead of granting matching props to place on top of it.
 *
 * Every entry here is a paid, ownable theme (see the "테마 BM 결함" fix): once
 * purchased once, a theme is recorded in inventory.ownedThemeIds and can be
 * re-applied for free forever after -- purchasePrototypeThemeBundle only
 * spends credits the first time.
 */
export interface ThemeBundle {
  id: string;
  /** Key into the app's theme background registry (themeBackgroundSourceById). */
  themeId: ItemId;
  nameEn: string;
  nameKo: string;
  descriptionEn: string;
  descriptionKo: string;
  creditCost: number;
}

export const themeBundles: ThemeBundle[] = [
  {
    id: "bundle_fairy_garden",
    themeId: "theme-fairy-garden",
    nameEn: "Fairy Garden",
    nameKo: "요정 정원",
    descriptionEn: "A glowing fairy garden backdrop for soft, dreamy days at home.",
    descriptionKo: "은은하게 빛나는 요정 정원 배경으로 집을 포근하게 꾸며보세요.",
    creditCost: 18
  },
  {
    id: "bundle_seaside_cove",
    themeId: "theme-seaside-cove",
    nameEn: "Seaside Cove",
    nameKo: "바닷가 코브",
    descriptionEn: "A bright coastal backdrop for breezy walk episodes.",
    descriptionKo: "산책하기 좋은 산뜻한 바닷가 배경이에요.",
    creditCost: 18
  },
  {
    id: "bundle_autumn_woods",
    themeId: "theme-autumn-woods",
    nameEn: "Autumn Woods",
    nameKo: "가을 숲",
    descriptionEn: "Warm leaves and soft golden light for seasonal care.",
    descriptionKo: "따뜻한 낙엽과 은은한 황금빛이 감도는 가을 배경이에요.",
    creditCost: 18
  },
  {
    id: "bundle_winter_lights",
    themeId: "theme-winter-lights",
    nameEn: "Winter Lights",
    nameKo: "겨울 불빛",
    descriptionEn: "A snowy evening backdrop with gentle festive glow.",
    descriptionKo: "포근한 축제 불빛이 감도는 눈 내리는 저녁 배경이에요.",
    creditCost: 18
  }
];

export const getThemeBundleById = (bundleId: string): ThemeBundle | null =>
  themeBundles.find((bundle) => bundle.id === bundleId) ?? null;

/** Looks up the bundle (if any) that sells a given background theme id -- used to price re-purchases/ownership checks by theme id rather than bundle id. */
export const getThemeBundleByThemeId = (themeId: ItemId): ThemeBundle | null =>
  themeBundles.find((bundle) => bundle.themeId === themeId) ?? null;
