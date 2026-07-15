import { useMemo } from "react";
import type { TextStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { getLocalizedText } from "../../localization/localizedText";
import { normalizeAppLocale } from "../../localization/localeNormalization";
import type { AppLocale } from "../../localization/localeNormalization";
import { fontPairFamilies, useFontPair } from "./fontPair";
import type { FontPairId } from "./fontPair";

export const colors = {
  sky: "#9FDBFF",
  skySoft: "#C9F0FF",
  skyDeep: "#3D91C8",
  mint: "#92DDBF",
  moss: "#3E7A42",
  leaf: "#54A85C",
  apple: "#8FCB43",
  coral: "#FF7F7B",
  coralDeep: "#9D3F3A",
  rose: "#FF9DC4",
  yellow: "#FFD36A",
  honey: "#F6B84F",
  gold: "#D99538",
  wood: "#B8773D",
  woodDark: "#80512E",
  cream: "#FFF5DE",
  parchment: "#FFE8C7",
  parchmentDeep: "#F6D1A3",
  ink: "#3B2E2A",
  mutedInk: "#7A6E66",
  line: "#E8CFA9",
  lavender: "#A789E9",
  violet: "#7D61C8",
  white: "#FFFFFF",
  overlay: "rgba(37,29,26,0.62)"
};

export const profileSurfaces = {
  heroPlate: "rgba(255,245,222,0.94)",
  skyPanel: "rgba(201,240,255,0.88)",
  skyCell: "rgba(255,255,255,0.9)",
  skyCellLocked: "rgba(122,110,102,0.2)",
  parchmentPanel: "rgba(255,245,222,0.94)",
  letterPanel: "rgba(255,232,199,0.96)",
  letterGlow: "rgba(246,184,79,0.34)",
  lightRim: "rgba(255,255,255,0.88)",
  softRim: "rgba(255,255,255,0.66)",
  mutedTrack: "rgba(122,110,102,0.18)"
};

export const homeRetentionSurfaces = {
  card: "rgba(255,245,222,0.95)",
  cardReward: "rgba(244,255,240,0.96)",
  cardMemory: "rgba(232,247,255,0.95)",
  cardLetter: "rgba(255,232,199,0.96)",
  rim: "rgba(255,255,255,0.9)",
  softRim: "rgba(255,255,255,0.68)",
  progressTrack: "rgba(122,110,102,0.16)"
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
};

export const radii = {
  card: 8,
  control: 14,
  panel: 24,
  pill: 999
};

export const shadows = {
  soft: {
    shadowColor: "#6D4B2A",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  button: {
    shadowColor: "#426A2B",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  gamePanel: {
    shadowColor: "#5E3B23",
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5
  },
  tile: {
    shadowColor: "#5E3B23",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  }
};

// --- Typography tokens -----------------------------------------------
//
// Every role below carries its own size/lineHeight/weight so existing
// visual hierarchy is preserved; only fontFamily is pair-dependent. Screens
// read the active pair's fontFamily through getTypography()/useTypography()
// instead of hardcoding a font name, so a pair switch (see
// shared/design/fontPair.ts) updates every screen from one place.
export type TypographyRole = "display" | "title" | "body" | "label" | "button" | "bubble";

type TypographyRoleBase = Pick<TextStyle, "fontSize" | "lineHeight" | "fontWeight">;

const typographyRoleBase: Record<TypographyRole, TypographyRoleBase> = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "900" },
  title: { fontSize: 22, lineHeight: 27, fontWeight: "900" },
  body: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "900" },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "900" },
  bubble: { fontSize: 12, lineHeight: 16, fontWeight: "800" }
};

// display/title/bubble read from the pair's display face; body/label/button
// read from the pair's body face (see W2 backlog: "Pixelify Sans" for
// display/title/bubble, "Baloo 2" for body/buttons/inputs).
const typographyRoleFaceKind: Record<TypographyRole, keyof typeof fontPairFamilies["A"]> = {
  display: "display",
  title: "display",
  body: "body",
  label: "body",
  button: "body",
  bubble: "display"
};

export type Typography = Record<TypographyRole, Required<TypographyRoleBase> & { fontFamily: string }>;

export const getFontFamilyForLocale = (locale: AppLocale, brandedFontFamily: string): string =>
  getLocalizedText(locale, {
    "en-US": brandedFontFamily,
    "ko-KR": "FusionPixel10Proportional_ko",
    "ja-JP": "FusionPixel10Proportional_ja",
    "zh-TW": "FusionPixel10Proportional_zhTW",
    "de-DE": brandedFontFamily,
    "fr-FR": brandedFontFamily,
    "pt-BR": brandedFontFamily,
    "es-MX": brandedFontFamily
  });

export const getTypography = (pairId: FontPairId): Typography => {
  const families = fontPairFamilies[pairId];

  return Object.fromEntries(
    (Object.keys(typographyRoleBase) as TypographyRole[]).map((role) => [
      role,
      {
        ...typographyRoleBase[role],
        fontFamily: families[typographyRoleFaceKind[role]]
      }
    ])
  ) as Typography;
};

/** Live typography for the currently active font pair; re-renders on pair switch. */
export const useTypography = (): Typography => {
  const [pairId] = useFontPair();
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);

  return useMemo(() => {
    const typography = getTypography(pairId);

    return Object.fromEntries(
      (Object.keys(typography) as TypographyRole[]).map((role) => [
        role,
        { ...typography[role], fontFamily: getFontFamilyForLocale(locale, typography[role].fontFamily) }
      ])
    ) as Typography;
  }, [locale, pairId]);
};

export type FontFamilies = Record<TypographyRole, string>;

/**
 * Just the pair-dependent fontFamily per role, for screens that keep their
 * own hand-tuned fontSize/lineHeight/fontWeight (preserving existing size
 * hierarchy) but still want fontFamily to follow the active font pair.
 * Merge into an existing style, e.g. [styles.title, { fontFamily: fontFamilies.title }].
 */
export const getFontFamilies = (pairId: FontPairId): FontFamilies => {
  const families = fontPairFamilies[pairId];

  return Object.fromEntries(
    (Object.keys(typographyRoleFaceKind) as TypographyRole[]).map((role) => [role, families[typographyRoleFaceKind[role]]])
  ) as FontFamilies;
};

/** Live per-role fontFamily map for the currently active font pair. */
export const useFontFamilies = (): FontFamilies => {
  const [pairId] = useFontPair();
  const { i18n } = useTranslation();
  const locale = normalizeAppLocale(i18n.resolvedLanguage);

  return useMemo(() => {
    const fontFamilies = getFontFamilies(pairId);

    return Object.fromEntries(
      (Object.keys(fontFamilies) as TypographyRole[]).map((role) => [
        role,
        getFontFamilyForLocale(locale, fontFamilies[role])
      ])
    ) as FontFamilies;
  }, [locale, pairId]);
};
