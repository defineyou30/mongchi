import type { GeneratedAssetId, GeneratedAssetState, ItemId } from "@mongchi/shared";
import { DEFAULT_THEME_ID, themeBundles } from "@mongchi/shared";

import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";
import { buildHeroPoseSlides, getHeroPoseLabel } from "./friendHeroPosePresentation";
import type { FriendPoseCell } from "./friendProfilePresentation";

// Pure selection logic for the friend page's "customize & share" card -- see
// FriendProfileScreen's Share button and ShareCardCustomizeSheet. Kept free
// of React/RN imports (no Image/require) so the ownership filtering and
// selection-state rules here stay cheaply unit-testable; the sheet resolves
// the actual RN image sources (pet sprite / theme background) itself.

// --- Pose picker (owned poses only) -------------------------------------

export interface ShareCardPoseOption {
  readonly state: GeneratedAssetState;
  /** Null only for the no-accepted-assets-yet fallback slide -- callers resolve a species fallback sprite for it, same as HeroPoseSlider does. */
  readonly assetId: GeneratedAssetId | null;
  readonly label: string;
}

/**
 * The poses a share card can be built from -- every pose the pet actually
 * owns right now (never a locked one), reusing the hero pager's own
 * ordering (idle first, so the card defaults to "how they usually look")
 * and its fallback (a single idle slide with no accepted assets yet).
 */
export const getShareCardPoseOptions = (
  cells: readonly FriendPoseCell[],
  locale: AppLocale = "en-US"
): ShareCardPoseOption[] =>
  buildHeroPoseSlides(cells).map(({ cell }) => ({
    state: cell.state,
    assetId: cell.assetId,
    label: getHeroPoseLabel(cell.state, locale)
  }));

/** Preferred state if it's still a valid (owned) option, else the first available pose. */
export const getInitialShareCardPoseState = (
  options: readonly ShareCardPoseOption[],
  preferredState: GeneratedAssetState | null
): GeneratedAssetState => {
  if (preferredState && options.some((option) => option.state === preferredState)) {
    return preferredState;
  }

  return options[0]?.state ?? "idle";
};

/** Rejects a request for a pose that isn't among the owned options, keeping the current selection instead. */
export const selectShareCardPose = (
  options: readonly ShareCardPoseOption[],
  requestedState: GeneratedAssetState,
  currentState: GeneratedAssetState
): GeneratedAssetState => (options.some((option) => option.state === requestedState) ? requestedState : currentState);

export const resolveShareCardPoseAssetId = (
  options: readonly ShareCardPoseOption[],
  poseState: GeneratedAssetState
): GeneratedAssetId | null => options.find((option) => option.state === poseState)?.assetId ?? null;

// --- Theme/backdrop picker (owned themes only) --------------------------

export interface ShareCardThemeOption {
  readonly themeId: ItemId;
  readonly name: string;
}

type ThemeCopyKey = "default" | "fairy" | "seaside" | "autumn" | "winter";

const themeCopyKeyById: Readonly<Record<ItemId, ThemeCopyKey>> = {
  [DEFAULT_THEME_ID]: "default",
  "theme-fairy-garden": "fairy",
  "theme-seaside-cove": "seaside",
  "theme-autumn-woods": "autumn",
  "theme-winter-lights": "winter"
};

const getThemeName = (themeId: ItemId, locale: AppLocale): string => {
  const themeCopy = getResourcesForLocale(locale).shop.themes;

  switch (themeCopyKeyById[themeId]) {
    case "fairy":
      return themeCopy.fairyName;
    case "seaside":
      return themeCopy.seasideName;
    case "autumn":
      return themeCopy.autumnName;
    case "winter":
      return themeCopy.winterName;
    default:
      return themeCopy.defaultName;
  }
};

/**
 * The backdrops a share card can be built from -- the always-owned default
 * garden plus every paid theme bundle the player has actually purchased.
 * Unpurchased themes never appear here: this picker customizes a card from
 * what's already owned, it isn't another shop upsell surface (see
 * themeBundles.ts and Inventory.ownedThemeIds).
 */
export const getShareCardThemeOptions = (
  ownedThemeIds: readonly ItemId[],
  locale: AppLocale = "en-US"
): ShareCardThemeOption[] => {
  const ownedSet = new Set(ownedThemeIds);
  const candidateThemeIds: ItemId[] = [DEFAULT_THEME_ID, ...themeBundles.map((bundle) => bundle.themeId)];

  return candidateThemeIds
    .filter((themeId) => themeId === DEFAULT_THEME_ID || ownedSet.has(themeId))
    .map((themeId) => ({ themeId, name: getThemeName(themeId, locale) }));
};

/** Preferred theme id if it's still a valid (owned) option, else the default garden. */
export const getInitialShareCardThemeId = (
  options: readonly ShareCardThemeOption[],
  preferredThemeId: ItemId | null
): ItemId => {
  if (preferredThemeId && options.some((option) => option.themeId === preferredThemeId)) {
    return preferredThemeId;
  }

  return options[0]?.themeId ?? DEFAULT_THEME_ID;
};

/** Rejects a request for a theme that isn't among the owned options, keeping the current selection instead. */
export const selectShareCardTheme = (
  options: readonly ShareCardThemeOption[],
  requestedThemeId: ItemId,
  currentThemeId: ItemId
): ItemId => (options.some((option) => option.themeId === requestedThemeId) ? requestedThemeId : currentThemeId);
