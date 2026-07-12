import { normalizeConfiguredUrl } from "../config/publicReleaseConfig";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";
import type { AppLocale } from "../../localization/localeNormalization";

export interface BrandedPetShareCardInput {
  readonly petName: string;
  readonly daysTogether?: number | null;
  readonly publicUrl?: string | null;
  readonly locale?: AppLocale;
}

export interface BrandedPetShareCardCopy {
  readonly petName: string;
  readonly heading: string;
  readonly warmLine: string;
  readonly attribution: string;
  readonly publicUrl: string | null;
}

const fallbackPetName = "My dog";

const cardHeading: LocalizedText = { "en-US": "MY TINY GARDEN FRIEND", "ko-KR": "나의 작은 정원 친구", "ja-JP": "小さな庭のお友だち", "zh-TW": "我的迷你花園朋友", "de-DE": "MEIN KLEINER GARTENFREUND", "fr-FR": "MON PETIT AMI DU JARDIN", "pt-BR": "MEU AMIGUINHO DO JARDIM", "es-MX": "MI AMIGUITO DEL JARDÍN" };
const cardFallbackPetName: LocalizedText = { "en-US": fallbackPetName, "ko-KR": "우리 강아지", "ja-JP": "うちの子", "zh-TW": "我家小寶貝", "de-DE": "Mein Hund", "fr-FR": "Mon chien", "pt-BR": "Meu cachorro", "es-MX": "Mi perrito" };
const cardWarmLine: LocalizedText = { "en-US": "A tiny friend, always close.", "ko-KR": "언제나 곁에 있는 작은 친구.", "ja-JP": "いつもそばにいる、小さなお友だち。", "zh-TW": "一直陪在身邊的迷你朋友。", "de-DE": "Ein kleiner Freund, immer ganz nah.", "fr-FR": "Un petit ami, toujours tout près.", "pt-BR": "Um amiguinho sempre por perto.", "es-MX": "Un amiguito siempre cerquita." };
const cardDaysLine: LocalizedText = { "en-US": "{{count}} {{day}} of tiny garden moments.", "ko-KR": "작은 정원에서 함께한 지 {{count}}일.", "ja-JP": "小さな庭で一緒に過ごして{{count}}日。", "zh-TW": "在迷你花園相伴的第 {{count}} 天。", "de-DE": "{{count}} {{day}} voller kleiner Gartenmomente.", "fr-FR": "{{count}} {{day}} de petits moments au jardin.", "pt-BR": "{{count}} {{day}} de pequenos momentos no jardim.", "es-MX": "{{count}} {{day}} de pequeños momentos en el jardín." };
const cardAttribution: LocalizedText = { "en-US": "Made with Mongchi", "ko-KR": "Mongchi에서 만들었어요", "ja-JP": "Mongchiで作りました", "zh-TW": "由 Mongchi 創造", "de-DE": "Erstellt mit Mongchi", "fr-FR": "Créé avec Mongchi", "pt-BR": "Feito com Mongchi", "es-MX": "Creado con Mongchi" };

const interpolateCardText = (text: string, values: Readonly<Record<string, string | number>>): string =>
  Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)), text);

const getCardDayWord = (locale: AppLocale, count: number): string => getLocalizedText(locale, {
  "en-US": count === 1 ? "day" : "days",
  "ko-KR": "일",
  "ja-JP": "日",
  "zh-TW": "天",
  "de-DE": count === 1 ? "Tag" : "Tage",
  "fr-FR": count === 1 ? "jour" : "jours",
  "pt-BR": count === 1 ? "dia" : "dias",
  "es-MX": count === 1 ? "día" : "días"
});

export const buildBrandedPetShareCardCopy = ({
  petName,
  daysTogether,
  publicUrl,
  locale = "en-US"
}: BrandedPetShareCardInput): BrandedPetShareCardCopy => {
  const normalizedPetName = petName.trim() || getLocalizedText(locale, cardFallbackPetName);
  const warmLine =
    typeof daysTogether === "number" && daysTogether > 0
      ? interpolateCardText(getLocalizedText(locale, cardDaysLine), {
          count: daysTogether,
          day: getCardDayWord(locale, daysTogether)
        })
      : getLocalizedText(locale, cardWarmLine);

  return {
    petName: normalizedPetName,
    heading: getLocalizedText(locale, cardHeading),
    warmLine,
    attribution: getLocalizedText(locale, cardAttribution),
    publicUrl: normalizeConfiguredUrl(publicUrl)
  };
};
