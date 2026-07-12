import i18n from "i18next";

import { normalizeAppLocale } from "./localeNormalization";
import { getResourcesForLocale } from "./resourceCatalog";

export const getRuntimeResources = () => getResourcesForLocale(normalizeAppLocale(i18n.resolvedLanguage));

export const isRuntimeKorean = (): boolean => i18n.resolvedLanguage === "ko-KR";

export const interpolatePetName = (value: string, petName: string): string =>
  value.replaceAll("{{petName}}", petName);
