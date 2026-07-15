import type { RewardClaimCopyCategory } from "@mongchi/shared";

import type { AppLocale } from "../../localization/localeNormalization";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";

/** What the reward-claim card shows before the owner taps "Receive". */
export interface RewardClaimCardCopy {
  title: string;
  body: string;
  accessibilityLabel: string;
}

/** Icon/art the card shows for a credit reward -- always the same gem art (GameItemImage item="gem"), regardless of category. Kept as its own type in case a future category wants different art. */
export type RewardClaimArt = "credit_gem" | "treat_item";

const settlementCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "A little moving-in gift",
    "ko-KR": "작은 이사 선물이 도착했어요",
    "ja-JP": "小さな引っ越し祝いが届いたよ",
    "zh-TW": "一份小小的入住禮物",
    "de-DE": "Ein kleines Einzugsgeschenk",
    "fr-FR": "Un petit cadeau de bienvenue",
    "pt-BR": "Um pequeno presente de boas-vindas",
    "es-MX": "Un pequeño regalo de bienvenida"
  },
  body: {
    "en-US": "Thank you for settling in together. Here's a little something.",
    "ko-KR": "우리 집에 자리 잡아줘서 고마워. 작은 선물 준비했어.",
    "ja-JP": "一緒に暮らし始めてくれてありがとう。ちょっとした贈り物だよ。",
    "zh-TW": "謝謝你陪我一起安頓下來,這是一點小心意。",
    "de-DE": "Danke, dass wir uns hier zusammen einleben. Hier ist eine Kleinigkeit.",
    "fr-FR": "Merci de t'installer avec moi. Voici un petit quelque chose.",
    "pt-BR": "Obrigado por se instalar comigo. Aqui está uma lembrancinha.",
    "es-MX": "Gracias por instalarte conmigo. Aquí tienes un pequeño detalle."
  }
};

const streakCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "A streak worth celebrating",
    "ko-KR": "축하할 만한 연속 기록이에요",
    "ja-JP": "お祝いしたい連続記録だよ",
    "zh-TW": "值得慶祝的連續紀錄",
    "de-DE": "Eine Serie, die man feiern sollte",
    "fr-FR": "Une série qui mérite d'être fêtée",
    "pt-BR": "Uma sequência que merece comemoração",
    "es-MX": "Una racha que merece celebrarse"
  },
  body: {
    "en-US": "You've shown up for me, day after day. Here's a little thank-you.",
    "ko-KR": "매일매일 나를 찾아와줬잖아. 작은 고마움을 담았어.",
    "ja-JP": "毎日ずっと会いに来てくれたね。ちょっとしたお礼だよ。",
    "zh-TW": "你每天都陪著我,這是一點小小的謝意。",
    "de-DE": "Du warst Tag für Tag für mich da. Hier ist ein kleines Dankeschön.",
    "fr-FR": "Tu es venu me voir jour après jour. Voici un petit merci.",
    "pt-BR": "Você apareceu para mim, dia após dia. Aqui está um agradecimento.",
    "es-MX": "Has venido a verme día tras día. Aquí tienes un pequeño agradecimiento."
  }
};

const letterCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "A note tucked into the letter",
    "ko-KR": "편지 속에 살짝 넣어둔 선물",
    "ja-JP": "手紙にそっと添えた贈り物",
    "zh-TW": "夾在信裡的小心意",
    "de-DE": "Ein kleines Extra im Brief",
    "fr-FR": "Un petit plus glissé dans la lettre",
    "pt-BR": "Um mimo junto com a carta",
    "es-MX": "Un detalle guardado en la carta"
  },
  body: {
    "en-US": "Reading back on our time together felt special, so I saved you something.",
    "ko-KR": "우리가 함께한 시간을 돌아보니 마음이 따뜻해져서, 이걸 남겨뒀어.",
    "ja-JP": "一緒に過ごした時間を振り返って、これを取っておいたよ。",
    "zh-TW": "回顧我們一起的時光很特別,所以留了這個給你。",
    "de-DE": "Der Rückblick auf unsere Zeit war etwas Besonderes, also hab ich dir das aufgehoben.",
    "fr-FR": "Repenser à notre temps ensemble m'a touché, alors je t'ai gardé ceci.",
    "pt-BR": "Relembrar nosso tempo juntos foi especial, então guardei isso para você.",
    "es-MX": "Recordar nuestro tiempo juntos se sintió especial, así que te guardé esto."
  }
};

const collectionCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "Our walk journal is complete",
    "ko-KR": "우리 산책 도감이 완성됐어요",
    "ja-JP": "お散歩図鑑が完成したよ",
    "zh-TW": "我們的散步圖鑑完成了",
    "de-DE": "Unser Spaziergang-Tagebuch ist vollständig",
    "fr-FR": "Notre carnet de balade est complet",
    "pt-BR": "Nosso diário de passeios está completo",
    "es-MX": "Nuestro diario de paseos está completo"
  },
  body: {
    "en-US": "Every little find, all in one place. Thank you for every walk.",
    "ko-KR": "작은 발견들이 전부 한자리에 모였어. 매번 함께 걸어줘서 고마워.",
    "ja-JP": "小さな発見が全部そろったね。毎回のお散歩、ありがとう。",
    "zh-TW": "每一個小發現都齊全了。謝謝你每一次的陪伴散步。",
    "de-DE": "Jeder kleine Fund an einem Ort. Danke für jeden Spaziergang.",
    "fr-FR": "Chaque petite trouvaille réunie. Merci pour chaque balade.",
    "pt-BR": "Cada pequena descoberta, tudo em um só lugar. Obrigado por cada passeio.",
    "es-MX": "Cada pequeño hallazgo, todo en un solo lugar. Gracias por cada paseo."
  }
};

const bondCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "We're closer than before",
    "ko-KR": "우리 사이가 더 가까워졌어요",
    "ja-JP": "もっと仲良くなれたね",
    "zh-TW": "我們的感情更近了",
    "de-DE": "Wir stehen uns näher als zuvor",
    "fr-FR": "Nous sommes plus proches qu'avant",
    "pt-BR": "Estamos mais próximos do que antes",
    "es-MX": "Estamos más cerca que antes"
  },
  body: {
    "en-US": "Every little moment added up to this. Here's something for us.",
    "ko-KR": "작은 순간들이 모여 여기까지 왔어. 우리를 위한 선물이야.",
    "ja-JP": "小さな瞬間が積み重なってここまで来たね。二人のための贈り物だよ。",
    "zh-TW": "每個小小的時刻累積成了現在。這是給我們的禮物。",
    "de-DE": "Jeder kleine Moment hat uns hierhergebracht. Hier ist etwas für uns.",
    "fr-FR": "Chaque petit instant nous a menés ici. Voici quelque chose pour nous.",
    "pt-BR": "Cada pequeno momento nos trouxe até aqui. Aqui está algo para nós.",
    "es-MX": "Cada pequeño momento nos trajo hasta aquí. Aquí tienes algo para nosotros."
  }
};

const dailyTreatCopy: { title: LocalizedText; body: LocalizedText } = {
  title: {
    "en-US": "You cared for me all day",
    "ko-KR": "오늘도 잘 돌봐줬어요",
    "ja-JP": "今日も一日お世話してくれたね",
    "zh-TW": "今天也好好照顧了我",
    "de-DE": "Du hast dich heute um mich gekümmert",
    "fr-FR": "Tu as pris soin de moi toute la journée",
    "pt-BR": "Você cuidou de mim o dia todo",
    "es-MX": "Me cuidaste todo el día"
  },
  body: {
    "en-US": "A little snack turned up, just for today's care.",
    "ko-KR": "오늘도 잘 돌봐줘서, 작은 간식이 생겼어.",
    "ja-JP": "今日のお世話のごほうびに、ちょっとしたおやつを見つけたよ。",
    "zh-TW": "因為今天的照顧,多了一份小點心。",
    "de-DE": "Für die heutige Fürsorge ist ein kleiner Snack aufgetaucht.",
    "fr-FR": "Une petite friandise est apparue, pour prendre soin de moi aujourd'hui.",
    "pt-BR": "Um lanchinho apareceu, só por causa do cuidado de hoje.",
    "es-MX": "Apareció un pequeño bocadillo, gracias al cuidado de hoy."
  }
};

const copyByCategory: Record<RewardClaimCopyCategory, { title: LocalizedText; body: LocalizedText }> = {
  settlement: settlementCopy,
  streak: streakCopy,
  letter: letterCopy,
  collection: collectionCopy,
  bond: bondCopy,
  daily_treat: dailyTreatCopy
};

const receiveButtonLabel: LocalizedText = {
  "en-US": "Receive",
  "ko-KR": "받기",
  "ja-JP": "受け取る",
  "zh-TW": "領取",
  "de-DE": "Annehmen",
  "fr-FR": "Recevoir",
  "pt-BR": "Receber",
  "es-MX": "Recibir"
};

const retryCopy: LocalizedText = {
  "en-US": "Couldn't reach the garden. Tap to try again.",
  "ko-KR": "정원에 닿지 못했어요. 다시 눌러주세요.",
  "ja-JP": "庭に届かなかったよ。もう一度タップしてね。",
  "zh-TW": "沒能連上花園,請再點一次。",
  "de-DE": "Der Garten war nicht erreichbar. Zum Wiederholen tippen.",
  "fr-FR": "Impossible de joindre le jardin. Appuie pour réessayer.",
  "pt-BR": "Não consegui chegar ao jardim. Toque para tentar de novo.",
  "es-MX": "No pude llegar al jardín. Toca para volver a intentarlo."
};

/** Title/body copy for the given category, in the given locale. */
export const getRewardClaimCardCopy = (category: RewardClaimCopyCategory, locale: AppLocale): RewardClaimCardCopy => {
  const copy = copyByCategory[category];

  return {
    title: getLocalizedText(locale, copy.title),
    body: getLocalizedText(locale, copy.body),
    accessibilityLabel: `${getLocalizedText(locale, copy.title)}. ${getLocalizedText(locale, copy.body)}`
  };
};

export const getRewardClaimReceiveButtonLabel = (locale: AppLocale): string => getLocalizedText(locale, receiveButtonLabel);

export const getRewardClaimRetryLine = (locale: AppLocale): string => getLocalizedText(locale, retryCopy);

/** Which art the card shows -- credit rewards always show the gem; the daily treat shows its granted item's own art. */
export const getRewardClaimArt = (kind: "credit" | "treat"): RewardClaimArt => (kind === "credit" ? "credit_gem" : "treat_item");
