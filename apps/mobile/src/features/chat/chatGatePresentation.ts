import { buildChatGreetingLine, createInitialCareStats, getCareStatBand, getTimeBucket, selectPetStatusLine } from "@mongchi/shared";
import type {
  CareState,
  CareSatisfactionSummary,
  CareStats,
  MemoryEntry,
  PremiumChatPaymentPreview,
  RecentReaction,
  WeatherContext
} from "@mongchi/shared";
import type { AppLocale } from "../../localization/localeNormalization";
import { getLocalizedText } from "../../localization/localizedText";

interface ShortChatReplyInput {
  petName: string;
  quickTalkStartedAtMs: number | null;
  recentReactions: readonly RecentReaction[];
  satisfactionSummary?: Pick<CareSatisfactionSummary, "primaryNeed" | "hint"> | undefined;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastInteractionAt" | "updatedAt"> | undefined;
  weather?: WeatherContext | null | undefined;
  now?: string | undefined;
  daysAway?: number | undefined;
  /** Recent remembered moments -- when present (and no quick-talk has started yet), the initial pet bubble greets with a "remembers me" line instead of the generic weather/care-status line. */
  memories?: readonly MemoryEntry[] | undefined;
  /** Accumulated care-pattern counters, paired with `memories` for the free memory-aware greeting. */
  careStats?: CareStats | undefined;
  /** True while the pet is out on an active walk -- outranks every other initial-greeting tier below (see buildChatGreetingLine). */
  isOnWalk?: boolean | undefined;
  locale?: AppLocale | undefined;
}

export interface PremiumChatAccessPresentationInput {
  petName: string;
  apiReady: boolean;
  payment: PremiumChatPaymentPreview;
  hasPremiumChatEntitlement: boolean;
  freeChatTickets: number;
  creditBalance: number;
  locale?: AppLocale | undefined;
}

export interface PremiumChatAccessPresentation {
  ready: boolean;
  /** True only when there is truly no way to start (no ticket, credit, or Plus) -- the sole state that should show any lock affordance. */
  isLocked: boolean;
  title: string;
  detail: string;
  balanceLabel: string;
  ctaLabel: string;
  inputPlaceholder: string;
  accessibilityLabel: string;
  chatPips: ChatTicketPipsPresentation;
}

export interface ChatTicketPipsPresentation {
  /** Soft label shown above/beside the pip row, e.g. "Today's little chats". */
  label: string;
  /** Filled pip count, capped at `total` for display. */
  filled: number;
  /** Total pip slots to render (dots), always >= filled. */
  total: number;
  /** Extra tickets beyond what pips can show, e.g. 2 for "+2" overflow. */
  overflow: number;
}

export interface ChatAllowanceChipPresentationInput {
  readonly hasPremiumChatEntitlement: boolean;
  readonly freeChatTickets: number;
  readonly creditBalance: number;
  readonly locale?: AppLocale | undefined;
}

export interface ChatAllowanceChipPresentation {
  readonly label: string;
  readonly accessibilityLabel: string;
}

export const getChatAllowanceChipPresentation = ({
  hasPremiumChatEntitlement,
  freeChatTickets,
  creditBalance,
  locale = "en-US"
}: ChatAllowanceChipPresentationInput): ChatAllowanceChipPresentation => {
  if (hasPremiumChatEntitlement) {
    return {
      label: getLocalizedText(locale, {
        "en-US": "Plus · Included",
        "ko-KR": "Plus · 포함",
        "ja-JP": "Plus · 利用中",
        "zh-TW": "Plus · 已包含",
        "de-DE": "Plus · Inbegriffen",
        "fr-FR": "Plus · Inclus",
        "pt-BR": "Plus · Incluído",
        "es-MX": "Plus · Incluido"
      }),
      accessibilityLabel: getLocalizedText(locale, {
        "en-US": "Plus chat is included",
        "ko-KR": "Plus 대화가 포함되어 있어요",
        "ja-JP": "Plusチャットが含まれています",
        "zh-TW": "已包含 Plus 聊天",
        "de-DE": "Plus-Chat ist inbegriffen",
        "fr-FR": "Le chat Plus est inclus",
        "pt-BR": "O chat Plus está incluído",
        "es-MX": "El chat Plus está incluido"
      })
    };
  }

  const chats = Math.max(0, Math.round(freeChatTickets));

  if (chats > 0) {
    return {
      label: getLocalizedText(locale, {
        "en-US": `${chats} chat${chats === 1 ? "" : "s"} left`,
        "ko-KR": `무료 대화 ${chats}회 남음`,
        "ja-JP": `無料チャット残り${chats}回`,
        "zh-TW": `剩餘 ${chats} 次免費聊天`,
        "de-DE": `${chats} Gratis-Chat${chats === 1 ? "" : "s"} übrig`,
        "fr-FR": `${chats} discussion${chats === 1 ? "" : "s"} gratuite${chats === 1 ? "" : "s"} restante${chats === 1 ? "" : "s"}`,
        "pt-BR": `${chats} conversa${chats === 1 ? "" : "s"} grátis restante${chats === 1 ? "" : "s"}`,
        "es-MX": `${chats} charla${chats === 1 ? "" : "s"} gratis restante${chats === 1 ? "" : "s"}`
      }),
      accessibilityLabel: getLocalizedText(locale, {
        "en-US": `${chats} free chat${chats === 1 ? "" : "s"} remaining`,
        "ko-KR": `오늘 무료 대화가 ${chats}회 남았어요`,
        "ja-JP": `今日の無料チャットはあと${chats}回です`,
        "zh-TW": `今天還有 ${chats} 次免費聊天`,
        "de-DE": `Heute sind noch ${chats} Gratis-Chat${chats === 1 ? "" : "s"} verfügbar`,
        "fr-FR": `Il reste ${chats} discussion${chats === 1 ? "" : "s"} gratuite${chats === 1 ? "" : "s"} aujourd’hui`,
        "pt-BR": `Restam ${chats} conversa${chats === 1 ? "" : "s"} grátis hoje`,
        "es-MX": `Quedan ${chats} charla${chats === 1 ? "" : "s"} gratis hoy`
      })
    };
  }

  const credits = Math.max(0, Math.round(creditBalance));

  return {
    label: getLocalizedText(locale, {
      "en-US": `${credits} credit${credits === 1 ? "" : "s"}`,
      "ko-KR": `크레딧 ${credits}개`,
      "ja-JP": `${credits}クレジット`,
      "zh-TW": `${credits} 點`,
      "de-DE": `${credits} Credit${credits === 1 ? "" : "s"}`,
      "fr-FR": `${credits} crédit${credits === 1 ? "" : "s"}`,
      "pt-BR": `${credits} crédito${credits === 1 ? "" : "s"}`,
      "es-MX": `${credits} crédito${credits === 1 ? "" : "s"}`
    }),
    accessibilityLabel: getLocalizedText(locale, {
      "en-US": `${credits} chat credit${credits === 1 ? "" : "s"} available`,
      "ko-KR": `대화에 사용할 수 있는 크레딧이 ${credits}개 있어요`,
      "ja-JP": `チャットに使えるクレジットは${credits}です`,
      "zh-TW": `有 ${credits} 點可用於聊天`,
      "de-DE": `${credits} Chat-Credit${credits === 1 ? "" : "s"} verfügbar`,
      "fr-FR": `${credits} crédit${credits === 1 ? "" : "s"} disponible${credits === 1 ? "" : "s"} pour discuter`,
      "pt-BR": `${credits} crédito${credits === 1 ? " disponível" : "s disponíveis"} para conversar`,
      "es-MX": `${credits} crédito${credits === 1 ? "" : "s"} disponible${credits === 1 ? "" : "s"} para chatear`
    })
  };
};

const chatPipDisplayCap = 5;

/**
 * Turns a raw free-chat-ticket count into a warm, bounded pip row instead of
 * a bare number — "Today's little chats: ●●○" reads softer than "1 ticket".
 * Plus members see an unlimited-feeling label instead of a ticket count.
 */
export const getChatTicketPipsPresentation = (
  freeChatTickets: number,
  hasPremiumChatEntitlement: boolean,
  locale: AppLocale = "en-US"
): ChatTicketPipsPresentation => {
  if (hasPremiumChatEntitlement) {
    return {
      label: getLocalizedText(locale, {
        "en-US": "Plus chats",
        "ko-KR": "Plus 대화",
        "ja-JP": "Plusチャット",
        "zh-TW": "Plus 聊天",
        "de-DE": "Plus-Chats",
        "fr-FR": "Discussions Plus",
        "pt-BR": "Conversas Plus",
        "es-MX": "Charlas Plus"
      }),
      filled: chatPipDisplayCap,
      total: chatPipDisplayCap,
      overflow: 0
    };
  }

  const safeTickets = Math.max(0, Math.round(freeChatTickets));
  const filled = Math.min(safeTickets, chatPipDisplayCap);
  const overflow = Math.max(0, safeTickets - chatPipDisplayCap);

  return {
    label: getLocalizedText(locale, {
      "en-US": "Today's little chats",
      "ko-KR": "오늘의 작은 대화",
      "ja-JP": "今日の小さなおしゃべり",
      "zh-TW": "今天的小聊天",
      "de-DE": "Heutige kleine Gespräche",
      "fr-FR": "Petites discussions du jour",
      "pt-BR": "Papos de hoje",
      "es-MX": "Charlitas de hoy"
    }),
    filled,
    total: chatPipDisplayCap,
    overflow
  };
};

export interface ChatMoodPresentationInput {
  petName: string;
  satisfactionScore: number;
  satisfactionSummary: Pick<CareSatisfactionSummary, "label" | "hint">;
  locale?: AppLocale | undefined;
}

export interface ChatMoodPresentation {
  value: number;
  label: string;
  accessibilityLabel: string;
}

export const getChatMoodPresentation = ({
  petName,
  satisfactionScore,
  satisfactionSummary,
  locale = "en-US"
}: ChatMoodPresentationInput): ChatMoodPresentation => {
  const value = Math.max(0, Math.min(100, Math.round(satisfactionScore)));

  return {
    value,
    label: getLocalizedText(locale, {
      "en-US": `Mood ${value}`,
      "ko-KR": `기분 ${value}`,
      "ja-JP": `気分 ${value}`,
      "zh-TW": `心情 ${value}`,
      "de-DE": `Stimmung ${value}`,
      "fr-FR": `Humeur ${value}`,
      "pt-BR": `Humor ${value}`,
      "es-MX": `Ánimo ${value}`
    }),
    accessibilityLabel: getLocalizedText(locale, {
      "en-US": `${petName} mood ${satisfactionSummary.label}, ${value} out of 100. ${satisfactionSummary.hint}`,
      "ko-KR": `${petName}의 기분은 100점 중 ${value}점이에요.`,
      "ja-JP": `${petName}の気分は100点満点中${value}点です。`,
      "zh-TW": `${petName} 的心情是 ${value} 分，滿分 100 分。`,
      "de-DE": `${petName}s Stimmung liegt bei ${value} von 100.`,
      "fr-FR": `L’humeur de ${petName} est de ${value} sur 100.`,
      "pt-BR": `O humor de ${petName} está em ${value} de 100.`,
      "es-MX": `El ánimo de ${petName} está en ${value} de 100.`
    })
  };
};

const getCareAwareShortReply = ({
  petName,
  satisfactionSummary,
  careState,
  weather,
  now = "2026-06-24T09:00:00.000Z",
  daysAway
}: Omit<ShortChatReplyInput, "quickTalkStartedAtMs" | "recentReactions">): string =>
  selectPetStatusLine({
    petName,
    satisfactionSummary,
    careState,
    weather,
    now,
    daysAway,
    surface: "chat"
  }).line;

export const getShortChatReplyText = ({
  petName,
  quickTalkStartedAtMs,
  recentReactions,
  satisfactionSummary,
  careState,
  weather,
  now,
  daysAway,
  memories,
  careStats,
  isOnWalk,
  locale = "en-US"
}: ShortChatReplyInput): string => {
  if (quickTalkStartedAtMs) {
    const reaction = recentReactions.find((entry) => new Date(entry.shownAt).getTime() >= quickTalkStartedAtMs);

    return reaction?.line ?? getLocalizedText(locale, {
      "en-US": `${petName} is listening...`,
      "ko-KR": `${petName}가 이야기를 듣고 있어요...`,
      "ja-JP": `${petName}がお話を聞いているよ...`,
      "zh-TW": `${petName} 正在聽你說話...`,
      "de-DE": `${petName} hört dir zu...`,
      "fr-FR": `${petName} t’écoute...`,
      "pt-BR": `${petName} está ouvindo...`,
      "es-MX": `${petName} te está escuchando...`
    });
  }

  if (locale === "en-US") {
    // Walking outranks every other greeting tier, including a fresh
    // milestone memory -- memories/careStats may not be loaded yet in every
    // caller, so this falls back to empty/initial values rather than
    // requiring them just to say "I'm out on a walk".
    if (isOnWalk) {
      return buildChatGreetingLine({
        petName,
        memories: memories ?? [],
        careStats: careStats ?? createInitialCareStats(),
        careState,
        now: now ?? "2026-06-24T09:00:00.000Z",
        isOnWalk: true
      });
    }

    if (memories && careStats) {
      return buildChatGreetingLine({
        petName,
        memories,
        careStats,
        careState,
        now: now ?? "2026-06-24T09:00:00.000Z"
      });
    }

    return getCareAwareShortReply({
      petName,
      satisfactionSummary,
      careState,
      weather,
      now,
      daysAway
    });
  }

  if (isOnWalk) {
    return getLocalizedText(locale, {
      "en-US": "On my walk! Smells amazing out here.",
      "ko-KR": "산책 중이야! 여기에는 신기한 냄새가 가득해.",
      "ja-JP": "お散歩中だよ！ここは不思議な匂いでいっぱい。",
      "zh-TW": "我正在散步！這裡到處都是新奇的味道。",
      "de-DE": "Ich bin spazieren! Hier gibt es so viele spannende Düfte.",
      "fr-FR": "Je suis en balade ! Il y a plein d’odeurs étonnantes ici.",
      "pt-BR": "Estou passeando! Tem tantos cheirinhos curiosos por aqui.",
      "es-MX": "¡Estoy de paseo! Por aquí hay muchos olores curiosos."
    });
  }

  if ((daysAway ?? 0) >= 1) {
    return getLocalizedText(locale, {
      "en-US": `${petName} kept one ear pointed at the door the whole time.`,
      "ko-KR": `${petName}는 문 쪽을 바라보며 기다렸어요.`,
      "ja-JP": `${petName}はずっとドアのほうを見ながら待っていたよ。`,
      "zh-TW": `${petName} 一直望著門口等你回來。`,
      "de-DE": `${petName} hat die ganze Zeit mit einem Ohr zur Tür gewartet.`,
      "fr-FR": `${petName} a attendu tout ce temps, une oreille tournée vers la porte.`,
      "pt-BR": `${petName} ficou esperando, com uma orelhinha virada para a porta.`,
      "es-MX": `${petName} esperó todo este tiempo con una orejita hacia la puerta.`
    });
  }

  if (memories && careStats) {
    return getLocalizedText(locale, {
      "en-US": "I remember all our little moments together.",
      "ko-KR": "우리의 작은 순간들을 다 기억하고 있어.",
      "ja-JP": "一緒に過ごした小さな思い出、ちゃんと覚えているよ。",
      "zh-TW": "我們一起度過的小時光，我都記得喔。",
      "de-DE": "Ich erinnere mich an all unsere kleinen gemeinsamen Momente.",
      "fr-FR": "Je me souviens de tous nos petits moments ensemble.",
      "pt-BR": "Eu me lembro de todos os nossos momentinhos juntos.",
      "es-MX": "Recuerdo todos nuestros pequeños momentos juntos."
    });
  }

  const need = satisfactionSummary?.primaryNeed;

  if (need === "food") {
    return getLocalizedText(locale, {
      "en-US": "My tummy is rumbling. Shall we have a snack together?",
      "ko-KR": "배에서 꼬르륵 소리가 나. 같이 간식 먹을까?",
      "ja-JP": "おなかがぐうぐう鳴ってるよ。一緒におやつを食べる？",
      "zh-TW": "肚子咕嚕咕嚕叫了。要一起吃點心嗎？",
      "de-DE": "Mein Bauch knurrt. Wollen wir zusammen einen Snack essen?",
      "fr-FR": "Mon ventre gargouille. On prend un petit goûter ensemble ?",
      "pt-BR": "Minha barriguinha está roncando. Vamos comer um petisco juntos?",
      "es-MX": "Me ruge la pancita. ¿Comemos un premio juntos?"
    });
  }

  if (need === "thirst") {
    return getLocalizedText(locale, {
      "en-US": "Tiny water emergency. My bowl needs a refill.",
      "ko-KR": "물 한 모금 마시면 기분이 좋아질 것 같아.",
      "ja-JP": "お水をひと口飲んだら、もっと元気になれそう。",
      "zh-TW": "喝一小口水，心情好像就會更好。",
      "de-DE": "Ein kleiner Schluck Wasser würde mir jetzt guttun.",
      "fr-FR": "Une petite gorgée d’eau me ferait du bien.",
      "pt-BR": "Um golinho de água ia me fazer tão bem.",
      "es-MX": "Un traguito de agua me haría sentir mucho mejor."
    });
  }

  if (need === "rest") {
    return getLocalizedText(locale, {
      "en-US": "I'm a little sleepy. Can I rest beside you?",
      "ko-KR": "조금 졸려. 네 곁에서 쉬어도 될까?",
      "ja-JP": "ちょっと眠たいな。そばで休んでもいい？",
      "zh-TW": "有一點睏了。可以在你身邊休息嗎？",
      "de-DE": "Ich bin ein bisschen müde. Darf ich mich bei dir ausruhen?",
      "fr-FR": "J’ai un peu sommeil. Je peux me reposer près de toi ?",
      "pt-BR": "Estou com um pouquinho de sono. Posso descansar pertinho de você?",
      "es-MX": "Tengo un poquito de sueño. ¿Puedo descansar a tu lado?"
    });
  }

  if (need === "play") {
    return getLocalizedText(locale, {
      "en-US": "I really want to play with you today.",
      "ko-KR": "오늘은 너와 신나게 놀고 싶어.",
      "ja-JP": "今日はきみとたくさん遊びたいな。",
      "zh-TW": "今天好想和你一起開心玩耍。",
      "de-DE": "Heute möchte ich so gern mit dir spielen.",
      "fr-FR": "J’ai très envie de jouer avec toi aujourd’hui.",
      "pt-BR": "Hoje eu queria tanto brincar com você.",
      "es-MX": "Hoy tengo muchas ganas de jugar contigo."
    });
  }

  if (need === "clean") {
    return getLocalizedText(locale, {
      "en-US": "I'd love to feel soft and fresh again.",
      "ko-KR": "보송보송하게 씻고 싶어.",
      "ja-JP": "ふわふわ、さっぱりしたいな。",
      "zh-TW": "好想洗得乾乾淨淨、蓬蓬鬆鬆。",
      "de-DE": "Ich würde mich gern wieder frisch und flauschig fühlen.",
      "fr-FR": "J’aimerais retrouver mon pelage tout doux et frais.",
      "pt-BR": "Queria ficar limpinho e fofinho de novo.",
      "es-MX": "Quiero volver a sentirme limpio y esponjoso."
    });
  }

  if (need === "attention") {
    return getLocalizedText(locale, {
      "en-US": "A gentle pet would make my heart feel warm.",
      "ko-KR": "쓰다듬어 주면 마음이 포근해질 것 같아.",
      "ja-JP": "なでてもらえたら、心がぽかぽかしそう。",
      "zh-TW": "摸摸我的話，心裡一定會暖暖的。",
      "de-DE": "Ein sanftes Streicheln würde mein Herz wärmen.",
      "fr-FR": "Une petite caresse réchaufferait mon cœur.",
      "pt-BR": "Um carinho seu deixaria meu coração bem quentinho.",
      "es-MX": "Una caricia tuya me calentaría el corazón."
    });
  }

  if (weather && weather.condition !== "clear") {
    return getLocalizedText(locale, {
      "en-US": "Even today's weather is quietly listening to us.",
      "ko-KR": "오늘 날씨도 우리 이야기를 조용히 듣고 있어.",
      "ja-JP": "今日のお天気も、ぼくらのお話をそっと聞いているね。",
      "zh-TW": "今天的天氣也在靜靜聽我們說話。",
      "de-DE": "Sogar das Wetter hört unserem Gespräch heute leise zu.",
      "fr-FR": "Même le temps écoute doucement notre conversation aujourd’hui.",
      "pt-BR": "Até o tempo está ouvindo nossa conversa bem quietinho hoje.",
      "es-MX": "Hasta el clima escucha nuestra charla en silencio hoy."
    });
  }

  return getLocalizedText(locale, {
    "en-US": "Sunlight is moving slowly across our little spot.",
    "ko-KR": "햇살이 우리 작은 자리를 천천히 지나가고 있어.",
    "ja-JP": "陽だまりがぼくらの小さな場所をゆっくり通り過ぎていくよ。",
    "zh-TW": "陽光正慢慢走過我們的小天地。",
    "de-DE": "Das Sonnenlicht wandert langsam durch unseren kleinen Platz.",
    "fr-FR": "La lumière glisse doucement sur notre petit coin.",
    "pt-BR": "A luz do sol está passeando devagar pelo nosso cantinho.",
    "es-MX": "La luz del sol recorre despacito nuestro rinconcito."
  });
};

export const getShortChatActionLabel = (quickTalkStartedAtMs: number | null, locale: AppLocale = "en-US"): string =>
  getLocalizedText(locale, quickTalkStartedAtMs ? {
    "en-US": "Say again",
    "ko-KR": "다시 말하기",
    "ja-JP": "もう一度話す",
    "zh-TW": "再說一次",
    "de-DE": "Noch einmal",
    "fr-FR": "Redire bonjour",
    "pt-BR": "Falar de novo",
    "es-MX": "Hablar de nuevo"
  } : {
    "en-US": "Say hello",
    "ko-KR": "인사하기",
    "ja-JP": "ごあいさつ",
    "zh-TW": "打聲招呼",
    "de-DE": "Hallo sagen",
    "fr-FR": "Dire bonjour",
    "pt-BR": "Dar um oi",
    "es-MX": "Saludar"
  });

export interface ChatConversationStarterInput {
  petName: string;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection"> | undefined;
  weather?: WeatherContext | null | undefined;
  now?: string | undefined;
  daysAway?: number | undefined;
  locale?: AppLocale | undefined;
}

/**
 * State-aware conversation starters so the healing chat opens with something the
 * pet plausibly "wants to talk about" instead of an empty input box.
 */
export const getChatConversationStarters = ({
  petName,
  careState,
  weather,
  now = "2026-06-24T09:00:00.000Z",
  daysAway,
  locale = "en-US"
}: ChatConversationStarterInput): string[] => {
  const starters: string[] = [];
  const timeBucket = getTimeBucket(new Date(now));

  if ((daysAway ?? 0) >= 1) {
    starters.push(getLocalizedText(locale, {
      "en-US": `I missed you, ${petName}. How were things here?`,
      "ko-KR": `${petName}, 보고 싶었어. 여기서 어떻게 지냈어?`,
      "ja-JP": `${petName}、会いたかったよ。ここではどう過ごしていたの？`,
      "zh-TW": `${petName}，我好想你。你在這裡過得好嗎？`,
      "de-DE": `Ich habe dich vermisst, ${petName}. Wie war es hier für dich?`,
      "fr-FR": `Tu m’as manqué, ${petName}. Comment ça s’est passé ici ?`,
      "pt-BR": `Senti sua falta, ${petName}. Como foi ficar por aqui?`,
      "es-MX": `Te extrañé, ${petName}. ¿Cómo estuviste por aquí?`
    }));
  }

  if (careState) {
    if (getCareStatBand(careState.happiness) === "low" || getCareStatBand(careState.happiness) === "critical") {
      starters.push(getLocalizedText(locale, {
        "en-US": "You look a little down today. Want to talk?",
        "ko-KR": "오늘 조금 시무룩해 보여. 같이 이야기할까?",
        "ja-JP": "今日はちょっと元気がないみたい。一緒にお話しする？",
        "zh-TW": "你今天看起來有點悶悶的。要聊聊嗎？",
        "de-DE": "Du wirkst heute etwas still. Möchtest du reden?",
        "fr-FR": "Tu as l’air un peu triste aujourd’hui. On en parle ?",
        "pt-BR": "Você parece um pouquinho triste hoje. Quer conversar?",
        "es-MX": "Te ves un poquito triste hoy. ¿Quieres platicar?"
      }));
    } else if (getCareStatBand(careState.energy) === "low" || getCareStatBand(careState.energy) === "critical") {
      starters.push(getLocalizedText(locale, {
        "en-US": "Feeling sleepy? Tell me about your dreams.",
        "ko-KR": "졸려 보여. 어떤 꿈을 꾸고 싶어?",
        "ja-JP": "眠たそうだね。どんな夢を見たい？",
        "zh-TW": "看起來睏睏的。你想做什麼樣的夢？",
        "de-DE": "Bist du schläfrig? Erzähl mir von deinen Träumen.",
        "fr-FR": "Tu as sommeil ? Raconte-moi les rêves que tu aimerais faire.",
        "pt-BR": "Está com soninho? Me conta com o que você quer sonhar.",
        "es-MX": "¿Tienes sueño? Cuéntame con qué te gustaría soñar."
      }));
    }
  }

  if (weather && weather.condition !== "clear") {
    starters.push(getLocalizedText(locale, {
      "en-US": `How do you like this ${weather.condition === "partly_cloudy" ? "cloudy" : weather.condition} weather?`,
      "ko-KR": "오늘 날씨는 마음에 들어?",
      "ja-JP": "今日のお天気、気に入った？",
      "zh-TW": "你喜歡今天的天氣嗎？",
      "de-DE": "Wie gefällt dir das Wetter heute?",
      "fr-FR": "Tu aimes le temps qu’il fait aujourd’hui ?",
      "pt-BR": "Você gostou do tempo de hoje?",
      "es-MX": "¿Te gusta el clima de hoy?"
    }));
  }

  if (timeBucket === "morning") {
    starters.push(getLocalizedText(locale, {
      "en-US": "Good morning! How did you sleep?",
      "ko-KR": "좋은 아침이야! 잘 잤어?",
      "ja-JP": "おはよう！よく眠れた？",
      "zh-TW": "早安！睡得好嗎？",
      "de-DE": "Guten Morgen! Hast du gut geschlafen?",
      "fr-FR": "Bonjour ! Tu as bien dormi ?",
      "pt-BR": "Bom dia! Dormiu bem?",
      "es-MX": "¡Buenos días! ¿Dormiste bien?"
    }));
  } else if (timeBucket === "night") {
    starters.push(getLocalizedText(locale, {
      "en-US": "It's getting late. Shall we wind down together?",
      "ko-KR": "늦었네. 같이 쉬면서 이야기할까?",
      "ja-JP": "もう遅いね。一緒にのんびりお話しする？",
      "zh-TW": "時間不早了。要一起放鬆聊聊天嗎？",
      "de-DE": "Es wird spät. Wollen wir zusammen zur Ruhe kommen?",
      "fr-FR": "Il se fait tard. On se détend ensemble ?",
      "pt-BR": "Está ficando tarde. Vamos relaxar juntinhos?",
      "es-MX": "Se está haciendo tarde. ¿Nos relajamos juntos?"
    }));
  } else {
    starters.push(getLocalizedText(locale, {
      "en-US": "How has your day been so far?",
      "ko-KR": "오늘 하루는 어땠어?",
      "ja-JP": "今日はどんな一日だった？",
      "zh-TW": "今天過得怎麼樣？",
      "de-DE": "Wie war dein Tag bisher?",
      "fr-FR": "Comment se passe ta journée ?",
      "pt-BR": "Como foi seu dia até agora?",
      "es-MX": "¿Cómo ha estado tu día?"
    }));
  }

  starters.push(getLocalizedText(locale, {
    "en-US": "I had a long day. Can I tell you about it?",
    "ko-KR": "오늘 하루가 길었어. 내 얘기 들어줄래?",
    "ja-JP": "今日は長い一日だったよ。お話を聞いてくれる？",
    "zh-TW": "今天感覺好漫長。可以聽我說說嗎？",
    "de-DE": "Ich hatte einen langen Tag. Darf ich dir davon erzählen?",
    "fr-FR": "J’ai eu une longue journée. Je peux te raconter ?",
    "pt-BR": "Meu dia foi longo. Posso te contar sobre ele?",
    "es-MX": "Tuve un día largo. ¿Te puedo contar?"
  }));

  return Array.from(new Set(starters)).slice(0, 3);
};

export const getPremiumChatAccessPresentation = ({
  petName,
  apiReady,
  payment,
  hasPremiumChatEntitlement,
  freeChatTickets,
  creditBalance,
  locale = "en-US"
}: PremiumChatAccessPresentationInput): PremiumChatAccessPresentation => {
  const paymentDetails: Record<PremiumChatPaymentPreview["mode"], string> = {
    plus_pass: getLocalizedText(locale, {
      "en-US": payment.detail,
      "ko-KR": "긴 대화가 포함되어 있어요.",
      "ja-JP": "ゆっくり話せるチャットが含まれています。",
      "zh-TW": "已包含長篇聊天。",
      "de-DE": "Längere Gespräche sind inbegriffen.",
      "fr-FR": "Les longues discussions sont incluses.",
      "pt-BR": "Conversas mais longas estão incluídas.",
      "es-MX": "Las conversaciones largas están incluidas."
    }),
    free_ticket: getLocalizedText(locale, {
      "en-US": payment.detail,
      "ko-KR": "다음 답장에 무료 대화 1회를 사용해요.",
      "ja-JP": "次の返信で無料チャットを1回使います。",
      "zh-TW": "下一則回覆會使用 1 次免費聊天。",
      "de-DE": "Die nächste Antwort nutzt einen Gratis-Chat.",
      "fr-FR": "La prochaine réponse utilise une discussion gratuite.",
      "pt-BR": "A próxima resposta usa uma conversa grátis.",
      "es-MX": "La siguiente respuesta usa una charla gratis."
    }),
    credit: getLocalizedText(locale, {
      "en-US": payment.detail,
      "ko-KR": `다음 답장에 크레딧 ${payment.creditCost}개를 사용해요.`,
      "ja-JP": `次の返信で${payment.creditCost}クレジット使います。`,
      "zh-TW": `下一則回覆會使用 ${payment.creditCost} 點。`,
      "de-DE": `Die nächste Antwort kostet ${payment.creditCost} Credit${payment.creditCost === 1 ? "" : "s"}.`,
      "fr-FR": `La prochaine réponse utilise ${payment.creditCost} crédit${payment.creditCost === 1 ? "" : "s"}.`,
      "pt-BR": `A próxima resposta usa ${payment.creditCost} crédito${payment.creditCost === 1 ? "" : "s"}.`,
      "es-MX": `La siguiente respuesta usa ${payment.creditCost} crédito${payment.creditCost === 1 ? "" : "s"}.`
    }),
    locked: getLocalizedText(locale, {
      "en-US": payment.detail,
      "ko-KR": "무료 대화 또는 크레딧이 필요해요.",
      "ja-JP": "無料チャットかクレジットが必要です。",
      "zh-TW": "需要免費聊天次數或點數。",
      "de-DE": "Du brauchst einen Gratis-Chat oder Credits.",
      "fr-FR": "Il faut une discussion gratuite ou des crédits.",
      "pt-BR": "Você precisa de uma conversa grátis ou de créditos.",
      "es-MX": "Necesitas una charla gratis o créditos."
    })
  };
  const paymentDetail = paymentDetails[payment.mode];
  const balanceLabel = hasPremiumChatEntitlement
    ? getLocalizedText(locale, {
        "en-US": "Plus active",
        "ko-KR": "Plus 이용 중",
        "ja-JP": "Plus利用中",
        "zh-TW": "Plus 使用中",
        "de-DE": "Plus aktiv",
        "fr-FR": "Plus actif",
        "pt-BR": "Plus ativo",
        "es-MX": "Plus activo"
      })
    : getLocalizedText(locale, {
        "en-US": `${freeChatTickets} ticket${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} credit${creditBalance === 1 ? "" : "s"}`,
        "ko-KR": `무료 대화 ${freeChatTickets}회 · 크레딧 ${creditBalance}개`,
        "ja-JP": `無料チャット${freeChatTickets}回 · ${creditBalance}クレジット`,
        "zh-TW": `免費聊天 ${freeChatTickets} 次 · ${creditBalance} 點`,
        "de-DE": `${freeChatTickets} Ticket${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} Credit${creditBalance === 1 ? "" : "s"}`,
        "fr-FR": `${freeChatTickets} ticket${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} crédit${creditBalance === 1 ? "" : "s"}`,
        "pt-BR": `${freeChatTickets} ingresso${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} crédito${creditBalance === 1 ? "" : "s"}`,
        "es-MX": `${freeChatTickets} boleto${freeChatTickets === 1 ? "" : "s"} · ${creditBalance} crédito${creditBalance === 1 ? "" : "s"}`
      });
  const chatPips = getChatTicketPipsPresentation(freeChatTickets, hasPremiumChatEntitlement, locale);
  const readyPlaceholder = getLocalizedText(locale, {
    "en-US": `Say something to ${petName}…`,
    "ko-KR": `${petName}에게 말 걸기…`,
    "ja-JP": `${petName}に話しかける…`,
    "zh-TW": `和 ${petName} 說點什麼…`,
    "de-DE": `Sag ${petName} etwas…`,
    "fr-FR": `Dites quelque chose à ${petName}…`,
    "pt-BR": `Diga algo para ${petName}…`,
    "es-MX": `Dile algo a ${petName}…`
  });

  if (apiReady && payment.canStart) {
    const title = getLocalizedText(locale, {
      "en-US": `Chatting with ${petName}`,
      "ko-KR": `${petName}와 대화하기`,
      "ja-JP": `${petName}とおしゃべり`,
      "zh-TW": `和 ${petName} 聊天`,
      "de-DE": `Plaudern mit ${petName}`,
      "fr-FR": `Discussion avec ${petName}`,
      "pt-BR": `Conversando com ${petName}`,
      "es-MX": `Charlando con ${petName}`
    });

    return {
      ready: true,
      isLocked: false,
      title,
      detail: paymentDetail,
      balanceLabel,
      ctaLabel: getLocalizedText(locale, {
        "en-US": "Start chatting",
        "ko-KR": "대화 시작",
        "ja-JP": "おしゃべりを始める",
        "zh-TW": "開始聊天",
        "de-DE": "Gespräch starten",
        "fr-FR": "Commencer à discuter",
        "pt-BR": "Começar a conversar",
        "es-MX": "Empezar a chatear"
      }),
      inputPlaceholder: readyPlaceholder,
      accessibilityLabel: getLocalizedText(locale, {
        "en-US": `Chat with ${petName} is ready. ${paymentDetail} Balance ${balanceLabel}.`,
        "ko-KR": `${petName}와 대화할 준비가 됐어요. ${paymentDetail} ${balanceLabel}.`,
        "ja-JP": `${petName}とおしゃべりする準備ができました。${paymentDetail} 残高は${balanceLabel}です。`,
        "zh-TW": `已準備好和 ${petName} 聊天。${paymentDetail} 餘額：${balanceLabel}。`,
        "de-DE": `Der Chat mit ${petName} ist bereit. ${paymentDetail} Guthaben: ${balanceLabel}.`,
        "fr-FR": `La discussion avec ${petName} est prête. ${paymentDetail} Solde : ${balanceLabel}.`,
        "pt-BR": `A conversa com ${petName} está pronta. ${paymentDetail} Saldo: ${balanceLabel}.`,
        "es-MX": `El chat con ${petName} está listo. ${paymentDetail} Saldo: ${balanceLabel}.`
      }),
      chatPips
    };
  }

  if (payment.canStart) {
    // Ticket/credit/Plus is available, but the long-chat API isn't wired up yet
    // (e.g. local/offline mode) -- still a "free chat is available" moment,
    // not a locked one, so the copy stays invitational rather than paywall-first.
    const title = getLocalizedText(locale, {
      "en-US": `${petName} is happy to chat`,
      "ko-KR": `${petName}가 이야기를 기다려요`,
      "ja-JP": `${petName}がおしゃべりを待っているよ`,
      "zh-TW": `${petName} 開心地等著聊天`,
      "de-DE": `${petName} freut sich aufs Plaudern`,
      "fr-FR": `${petName} a envie de discuter`,
      "pt-BR": `${petName} está feliz para conversar`,
      "es-MX": `${petName} tiene ganas de charlar`
    });

    return {
      ready: false,
      isLocked: false,
      title,
      detail: paymentDetail,
      balanceLabel,
      ctaLabel: getLocalizedText(locale, {
        "en-US": "Say hello",
        "ko-KR": "인사하기",
        "ja-JP": "ごあいさつ",
        "zh-TW": "打聲招呼",
        "de-DE": "Hallo sagen",
        "fr-FR": "Dire bonjour",
        "pt-BR": "Dar um oi",
        "es-MX": "Saludar"
      }),
      inputPlaceholder: readyPlaceholder,
      accessibilityLabel: getLocalizedText(locale, {
        "en-US": `${petName} is ready for a quick chat. ${paymentDetail} Balance ${balanceLabel}.`,
        "ko-KR": `${petName}가 짧은 대화를 기다려요. ${paymentDetail} ${balanceLabel}.`,
        "ja-JP": `${petName}が短いおしゃべりを待っています。${paymentDetail} 残高は${balanceLabel}です。`,
        "zh-TW": `${petName} 正等著和你聊一下。${paymentDetail} 餘額：${balanceLabel}。`,
        "de-DE": `${petName} ist bereit für ein kurzes Gespräch. ${paymentDetail} Guthaben: ${balanceLabel}.`,
        "fr-FR": `${petName} attend une petite discussion. ${paymentDetail} Solde : ${balanceLabel}.`,
        "pt-BR": `${petName} está esperando um papo rapidinho. ${paymentDetail} Saldo: ${balanceLabel}.`,
        "es-MX": `${petName} está listo para una charla breve. ${paymentDetail} Saldo: ${balanceLabel}.`
      }),
      chatPips
    };
  }

  const title = getLocalizedText(locale, {
    "en-US": `${petName} will have more to say tomorrow`,
    "ko-KR": `${petName}는 내일 더 많은 이야기를 들려줄 거예요`,
    "ja-JP": `${petName}は明日またたくさんお話ししてくれるよ`,
    "zh-TW": `${petName} 明天還有更多話想告訴你`,
    "de-DE": `${petName} hat morgen wieder mehr zu erzählen`,
    "fr-FR": `${petName} aura encore des choses à raconter demain`,
    "pt-BR": `${petName} terá mais coisas para contar amanhã`,
    "es-MX": `${petName} tendrá más cosas que contar mañana`
  });

  return {
    ready: false,
    isLocked: true,
    title,
    detail: getLocalizedText(locale, {
      "en-US": "...or keep chatting with credits.",
      "ko-KR": "크레딧으로 대화를 계속할 수도 있어요.",
      "ja-JP": "クレジットを使えば、もう少しお話しできます。",
      "zh-TW": "也可以使用點數繼續聊天。",
      "de-DE": "Du kannst mit Credits weiterplaudern.",
      "fr-FR": "Vous pouvez aussi continuer avec des crédits.",
      "pt-BR": "Você também pode continuar a conversa com créditos.",
      "es-MX": "También puedes seguir charlando con créditos."
    }),
    balanceLabel,
    ctaLabel: getLocalizedText(locale, {
      "en-US": "Get more credits",
      "ko-KR": "크레딧 받기",
      "ja-JP": "クレジットを追加",
      "zh-TW": "取得更多點數",
      "de-DE": "Mehr Credits holen",
      "fr-FR": "Obtenir des crédits",
      "pt-BR": "Conseguir mais créditos",
      "es-MX": "Conseguir más créditos"
    }),
    inputPlaceholder: getLocalizedText(locale, {
      "en-US": `${petName} will have more to say tomorrow — or keep chatting with credits.`,
      "ko-KR": `${petName}는 내일 더 많은 이야기를 들려줄 거예요`,
      "ja-JP": `${petName}とは明日またお話しできるよ`,
      "zh-TW": `${petName} 明天還有更多話想說`,
      "de-DE": `${petName} hat morgen wieder mehr zu erzählen`,
      "fr-FR": `${petName} aura encore des choses à raconter demain`,
      "pt-BR": `${petName} terá mais coisas para contar amanhã`,
      "es-MX": `${petName} tendrá más cosas que contar mañana`
    }),
    accessibilityLabel: getLocalizedText(locale, {
      "en-US": `Out of free chats for today. ${petName} will have more to say tomorrow, or you can keep chatting with credits. Balance ${balanceLabel}.`,
      "ko-KR": `오늘의 무료 대화를 모두 사용했어요. 내일 다시 이야기하거나 크레딧으로 계속할 수 있어요. ${balanceLabel}.`,
      "ja-JP": `今日の無料チャットは使い切りました。明日また話すか、クレジットで続けられます。残高は${balanceLabel}です。`,
      "zh-TW": `今天的免費聊天次數已用完。可以明天再聊，或使用點數繼續。餘額：${balanceLabel}。`,
      "de-DE": `Die Gratis-Chats für heute sind aufgebraucht. Morgen könnt ihr weiterreden oder jetzt Credits nutzen. Guthaben: ${balanceLabel}.`,
      "fr-FR": `Les discussions gratuites du jour sont terminées. Revenez demain ou continuez avec des crédits. Solde : ${balanceLabel}.`,
      "pt-BR": `As conversas grátis de hoje acabaram. Volte amanhã ou continue com créditos. Saldo: ${balanceLabel}.`,
      "es-MX": `Las charlas gratis de hoy se terminaron. Vuelve mañana o continúa con créditos. Saldo: ${balanceLabel}.`
    }),
    chatPips
  };
};
