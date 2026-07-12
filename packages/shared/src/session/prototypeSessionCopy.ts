import type { Locale } from "../domain/common";

type BondCelebrationInput = {
  readonly english: string;
  readonly korean: string;
  readonly level: number;
  readonly locale: Locale;
};

const genericBondCelebrationByLocale: Record<Locale, (level: number) => string> = {
  "en-US": (level) => `Our bond reached level ${level}! Thank you for all the little moments.`,
  "ko-KR": (level) => `우리 유대가 레벨 ${level}이 됐어! 작은 순간들을 함께해 줘서 고마워.`,
  "ja-JP": (level) => `ふたりの絆がレベル${level}になったよ！小さな時間を一緒に過ごしてくれてありがとう。`,
  "zh-TW": (level) => `我們的羈絆升到 ${level} 級了！謝謝你陪我度過每個小時光。`,
  "de-DE": (level) => `Unsere Bindung hat Stufe ${level} erreicht! Danke für all die kleinen Momente.`,
  "fr-FR": (level) => `Notre lien a atteint le niveau ${level} ! Merci pour tous ces petits moments.`,
  "pt-BR": (level) => `Nosso vínculo chegou ao nível ${level}! Obrigado por todos os pequenos momentos.`,
  "es-MX": (level) => `¡Nuestro vínculo llegó al nivel ${level}! Gracias por todos estos pequeños momentos.`
};

export const getBondCelebrationLine = ({ english, korean, level, locale }: BondCelebrationInput): string => {
  if (locale === "en-US") {
    return english;
  }

  if (locale === "ko-KR") {
    return korean;
  }

  return genericBondCelebrationByLocale[locale](level);
};

type StreakSnackInput = {
  readonly count: number;
  readonly locale: Locale;
  readonly special: boolean;
};

export const getStreakSnackLine = ({ count, locale, special }: StreakSnackInput): string => {
  const copyByLocale: Record<Locale, string> = {
    "en-US": special
      ? `${count} days together - Mong saved you a special snack.`
      : `${count} days together - Mong saved you a snack.`,
    "ko-KR": special
      ? `${count}일 연속이야! 특별한 간식을 아껴뒀어.`
      : `${count}일 연속이야! 작은 간식을 챙겨왔어.`,
    "ja-JP": special
      ? `${count}日連続だよ！特別なおやつを取っておいたよ。`
      : `${count}日連続だよ！小さなおやつを持ってきたよ。`,
    "zh-TW": special
      ? `連續 ${count} 天了！我為你留了一份特別點心。`
      : `連續 ${count} 天了！我帶了一份小點心。`,
    "de-DE": special
      ? `${count} Tage zusammen! Mong hat dir einen besonderen Snack aufgehoben.`
      : `${count} Tage zusammen! Mong hat dir einen Snack aufgehoben.`,
    "fr-FR": special
      ? `${count} jours ensemble ! Mong t'a gardé une friandise spéciale.`
      : `${count} jours ensemble ! Mong t'a gardé une petite friandise.`,
    "pt-BR": special
      ? `${count} dias juntos! Mong guardou um petisco especial para você.`
      : `${count} dias juntos! Mong guardou um petisco para você.`,
    "es-MX": special
      ? `¡${count} días juntos! Mong te guardó un premio especial.`
      : `¡${count} días juntos! Mong te guardó un premio.`
  };

  return copyByLocale[locale];
};

export const getWalkCollectionCompleteLine = (locale: Locale): string => ({
  "en-US": "Journal complete! Every little discovery we collected is here. Aren't we amazing?",
  "ko-KR": "도감 완성! 우리가 모은 작은 발견들이 전부 모였어. 정말 대단하지 않아?",
  "ja-JP": "お散歩図鑑が完成！集めた小さな発見が全部そろったよ。すごいね！",
  "zh-TW": "散步圖鑑完成！我們收集的小發現全都到齊了。很厲害吧！",
  "de-DE": "Das Spaziergangstagebuch ist komplett! Alle kleinen Entdeckungen sind da. Sind wir nicht großartig?",
  "fr-FR": "Le carnet de promenade est complet ! Toutes nos petites découvertes sont là. On est formidables, non ?",
  "pt-BR": "Diário de passeio completo! Todas as nossas pequenas descobertas estão aqui. Somos demais, né?",
  "es-MX": "¡Diario de paseos completo! Ya están todos nuestros pequeños hallazgos. ¿A poco no somos increíbles?"
})[locale];

type WalkDiscoveryInput = {
  readonly englishName: string;
  readonly isRare: boolean;
  readonly koreanName: string;
  readonly locale: Locale;
};

export const getWalkDiscoveryLine = ({ englishName, isRare, koreanName, locale }: WalkDiscoveryInput): string => {
  const copyByLocale: Record<Locale, string> = {
    "en-US": `A new find! I brought home a ${englishName}${isRare ? "... this one is really special!" : "."}`,
    "ko-KR": `새 발견이야! ${koreanName}${isRare ? "... 이건 정말 귀한 거야!" : "을(를) 주워왔어."}`,
    "ja-JP": isRare ? "新しい発見！とっても珍しいものを見つけたよ！" : "新しい発見！お散歩から小さなおみやげを持ってきたよ。",
    "zh-TW": isRare ? "新發現！我找到了一個非常珍貴的東西！" : "新發現！我從散步帶回了一份小禮物。",
    "de-DE": isRare ? "Neuer Fund! Ich habe etwas ganz Besonderes gefunden!" : "Neuer Fund! Ich habe ein kleines Andenken vom Spaziergang mitgebracht.",
    "fr-FR": isRare ? "Nouvelle trouvaille ! J'ai trouvé quelque chose de vraiment rare !" : "Nouvelle trouvaille ! J'ai rapporté un petit souvenir de promenade.",
    "pt-BR": isRare ? "Nova descoberta! Encontrei algo muito especial!" : "Nova descoberta! Trouxe uma pequena lembrança do passeio.",
    "es-MX": isRare ? "¡Nuevo hallazgo! ¡Encontré algo muy especial!" : "¡Nuevo hallazgo! Traje un pequeño recuerdo del paseo."
  };

  return copyByLocale[locale];
};
