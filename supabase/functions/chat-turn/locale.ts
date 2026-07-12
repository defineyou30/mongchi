export const supportedChatLocales = [
  "en-US",
  "ko-KR",
  "ja-JP",
  "zh-TW",
  "de-DE",
  "fr-FR",
  "pt-BR",
  "es-MX"
] as const;

export type ChatLocale = (typeof supportedChatLocales)[number];

export const parseChatLocale = (value: unknown): ChatLocale | null => {
  switch (value) {
    case "en-US":
    case "ko-KR":
    case "ja-JP":
    case "zh-TW":
    case "de-DE":
    case "fr-FR":
    case "pt-BR":
    case "es-MX":
      return value;
    default:
      return null;
  }
};

export const resolveChatLocale = (value: unknown): ChatLocale => parseChatLocale(value) ?? "en-US";
