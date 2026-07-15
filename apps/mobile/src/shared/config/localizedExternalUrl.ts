import { defaultAppLocale } from "../../localization/localeNormalization";
import type { AppLocale } from "../../localization/localeNormalization";

// Appends the active app locale as a `lang` query parameter so the MongChi
// landing pages (apps/landing) render in the same language as the app.
// Landing's own internal links follow the same convention: the default
// locale (en-US) is left off the URL, every other supported locale is set
// explicitly, and any existing query string (including a stale `lang`) is
// preserved or overwritten safely via the URL API.
export const buildLocalizedExternalUrl = (url: string, locale: AppLocale): string => {
  if (locale === defaultAppLocale) {
    return url;
  }

  try {
    const parsed = new URL(url);
    parsed.searchParams.set("lang", locale);
    return parsed.toString();
  } catch {
    return url;
  }
};
