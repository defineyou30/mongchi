import { bondLevelRewards, getCareStatBand, getExpressionPackById, NIGHT_CARE_ACKNOWLEDGEMENT_LINE, selectPetStatusLine } from "@mongchi/shared";
import type {
  ActiveCareBuff,
  CareActionReward,
  CareActionType,
  CareSatisfactionSummary,
  CareState,
  CareStatBand,
  MemoryEntry,
  PetStatusNeed,
  PetStatusSource,
  RelationshipState,
  SelectedEpisodeLine,
  SelectedReaction,
  WeatherContext,
  WalkCollectible,
  WalkSession
} from "@mongchi/shared";
import type { AppLocale } from "../../localization/localeNormalization";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";

export type HomeThoughtIcon = "heart" | "food" | "toy" | "water" | "clean" | "rest" | "attention";
export type HomeCareActionFeedbackIcon = "food" | "talk" | "walk" | "play" | "rest" | "heart" | "water" | "clean" | "treat" | "reward";
export type HomeCareActionFeedbackTone = "care" | "tradeoff" | "reward";

/** A brief, self-dismissing celebration toast for streak/buff moments (see HomeEventToast). */
export interface HomeEventTogglePresentation {
  id: string;
  line: string;
  accessibilityLabel: string;
}

export type HudMeterKey = "fullness" | "thirst" | "mood" | "energy" | "cleanliness";

export interface HomeThoughtPresentation {
  icon: HomeThoughtIcon;
  line: string;
  accessibilityLabel: string;
}

export type HomeWalkCtaStatus = "start" | "walking" | "hidden";

export interface HomeWalkCtaPresentation {
  status: HomeWalkCtaStatus;
  label: string;
  line: string;
  accessibilityLabel: string;
}

export interface HomeWalkPanelVisibility {
  shouldShowClaimedWalkRewardNotice: boolean;
  showCareDock: boolean;
}

export interface HomeCareActionFeedbackDelta {
  label: string;
  value: number;
}

export interface HomeCareActionFeedbackPresentation {
  icon: HomeCareActionFeedbackIcon;
  tone: HomeCareActionFeedbackTone;
  title: string;
  line: string;
  deltas: HomeCareActionFeedbackDelta[];
  accessibilityLabel: string;
}

const AMBIENT_REACTION_WINDOW_MS = 5 * 60 * 1000;

/**
 * Coarse, stable seed for the home screen's ambient reaction pick: the same
 * pet + same care-stat bands + same weather + same 5-minute window always
 * resolves to the same seed. Feed this into `createSeededRandom` and pass the
 * result as `selectLocalReaction`'s `options.random` so the ambient reaction
 * (and therefore the speech bubble line) stays put across renders that share
 * a window, instead of reshuffling on every render via unseeded
 * `Math.random()`. The home screen re-renders every second (clock tick), so
 * without this the bubble's typewriter key would reset before ever finishing
 * a sentence — reading as an empty/invisible bubble.
 */
export const getAmbientReactionSeed = (
  petId: string,
  careState: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection">,
  now: string,
  weather: Pick<WeatherContext, "condition" | "intensity">
): string => {
  const windowSlot = Math.floor(new Date(now).getTime() / AMBIENT_REACTION_WINDOW_MS);
  const bandKey = [
    getCareStatBand(careState.satiety),
    getCareStatBand(careState.happiness),
    getCareStatBand(careState.energy),
    getCareStatBand(careState.gardenHealth),
    getCareStatBand(careState.cleanliness),
    getCareStatBand(careState.affection)
  ].join(".");

  return [petId, bandKey, weather.condition, weather.intensity, windowSlot].join("|");
};

const feedbackTitleByAction: Record<CareActionType, LocalizedText> = {
  feed: { "en-US": "Bowl filled", "ko-KR": "밥을 채웠어요", "ja-JP": "ごはんを入れました", "zh-TW": "餐碗裝滿了", "de-DE": "Napf gefüllt", "fr-FR": "Gamelle remplie", "pt-BR": "Tigela cheia", "es-MX": "Plato lleno" },
  talk: { "en-US": "Hello shared", "ko-KR": "인사를 나눴어요", "ja-JP": "あいさつしました", "zh-TW": "交換了問候", "de-DE": "Gruß geteilt", "fr-FR": "Petit bonjour partagé", "pt-BR": "Olá compartilhado", "es-MX": "Saludo compartido" },
  walk: { "en-US": "Path started", "ko-KR": "산책을 시작했어요", "ja-JP": "お散歩を始めました", "zh-TW": "出發散步了", "de-DE": "Spaziergang begonnen", "fr-FR": "Promenade commencée", "pt-BR": "Passeio iniciado", "es-MX": "Paseo iniciado" },
  play: { "en-US": "Play time", "ko-KR": "신나게 놀았어요", "ja-JP": "遊びの時間", "zh-TW": "玩耍時間", "de-DE": "Spielzeit", "fr-FR": "Moment de jeu", "pt-BR": "Hora de brincar", "es-MX": "Hora de jugar" },
  rest: { "en-US": "Rested", "ko-KR": "푹 쉬었어요", "ja-JP": "ゆっくり休みました", "zh-TW": "好好休息了", "de-DE": "Ausgeruht", "fr-FR": "Bien reposé", "pt-BR": "Descansou", "es-MX": "Descansó" },
  affection: { "en-US": "Gentle pet", "ko-KR": "다정하게 쓰다듬었어요", "ja-JP": "やさしくなでました", "zh-TW": "溫柔摸摸", "de-DE": "Sanft gestreichelt", "fr-FR": "Douce caresse", "pt-BR": "Carinho gentil", "es-MX": "Caricia suave" },
  water_garden: { "en-US": "Water served", "ko-KR": "물을 채웠어요", "ja-JP": "お水を入れました", "zh-TW": "裝好水了", "de-DE": "Wasser bereit", "fr-FR": "Eau servie", "pt-BR": "Água servida", "es-MX": "Agua servida" },
  clean: { "en-US": "Fresh again", "ko-KR": "보송해졌어요", "ja-JP": "またさっぱり", "zh-TW": "又清爽了", "de-DE": "Wieder frisch", "fr-FR": "À nouveau tout frais", "pt-BR": "Fresquinho de novo", "es-MX": "Fresco de nuevo" },
  treat: { "en-US": "Treat joy", "ko-KR": "간식이 즐거워요", "ja-JP": "おやつの喜び", "zh-TW": "點心好開心", "de-DE": "Leckerli-Freude", "fr-FR": "Joie de la friandise", "pt-BR": "Alegria do petisco", "es-MX": "Alegría del premio" }
};

const feedbackIconByAction: Record<CareActionType, HomeCareActionFeedbackIcon> = {
  feed: "food",
  talk: "talk",
  walk: "walk",
  play: "play",
  rest: "rest",
  affection: "heart",
  water_garden: "water",
  clean: "clean",
  treat: "treat"
};

const careDeltaFields: Array<{ key: keyof Pick<CareState, "satiety" | "happiness" | "energy" | "cleanliness" | "gardenHealth" | "affection">; label: LocalizedText }> = [
  { key: "satiety", label: { "en-US": "Food", "ko-KR": "밥", "ja-JP": "ごはん", "zh-TW": "飽足", "de-DE": "Futter", "fr-FR": "Repas", "pt-BR": "Comida", "es-MX": "Comida" } },
  { key: "happiness", label: { "en-US": "Mood", "ko-KR": "기분", "ja-JP": "気分", "zh-TW": "心情", "de-DE": "Laune", "fr-FR": "Humeur", "pt-BR": "Humor", "es-MX": "Ánimo" } },
  { key: "energy", label: { "en-US": "Energy", "ko-KR": "에너지", "ja-JP": "元気", "zh-TW": "精力", "de-DE": "Energie", "fr-FR": "Énergie", "pt-BR": "Energia", "es-MX": "Energía" } },
  { key: "cleanliness", label: { "en-US": "Clean", "ko-KR": "청결", "ja-JP": "清潔", "zh-TW": "清潔", "de-DE": "Sauber", "fr-FR": "Propreté", "pt-BR": "Limpeza", "es-MX": "Limpieza" } },
  { key: "gardenHealth", label: { "en-US": "Water", "ko-KR": "물", "ja-JP": "お水", "zh-TW": "水分", "de-DE": "Wasser", "fr-FR": "Eau", "pt-BR": "Água", "es-MX": "Agua" } },
  { key: "affection", label: { "en-US": "Affection", "ko-KR": "유대감", "ja-JP": "絆", "zh-TW": "感情", "de-DE": "Zuneigung", "fr-FR": "Affection", "pt-BR": "Afeto", "es-MX": "Afecto" } }
];

const formatDelta = ({ label, value }: HomeCareActionFeedbackDelta): string => `${label} ${value > 0 ? "+" : ""}${value}`;

const getCareActionTone = (
  action: CareActionType,
  deltas: readonly HomeCareActionFeedbackDelta[],
  reward: CareActionReward | null
): HomeCareActionFeedbackTone => {
  if (reward || action === "treat") {
    return "reward";
  }

  if (deltas.some((delta) => delta.value < 0)) {
    return "tradeoff";
  }

  return "care";
};

const getRewardLine = (reward: CareActionReward, locale: AppLocale): string | null => {
  if (reward.type === "item") {
    return `${getLocalizedText(locale, { "en-US": "Item", "ko-KR": "아이템", "ja-JP": "アイテム", "zh-TW": "物品", "de-DE": "Gegenstand", "fr-FR": "Objet", "pt-BR": "Item", "es-MX": "Objeto" })} x${reward.quantity}`;
  }

  return null;
};

export const getHomeCareActionFeedbackPresentation = ({
  action,
  previousCareState,
  nextCareState,
  previousRelationshipState,
  nextRelationshipState,
  reward,
  locale = "en-US"
}: {
  action: CareActionType;
  previousCareState: CareState;
  nextCareState: CareState;
  previousRelationshipState: RelationshipState;
  nextRelationshipState: RelationshipState;
  reward?: CareActionReward | null;
  locale?: AppLocale;
}): HomeCareActionFeedbackPresentation => {
  const careDeltas = careDeltaFields
    .map(({ key, label }) => ({
      label: getLocalizedText(locale, label),
      value: nextCareState[key] - previousCareState[key]
    }))
    .filter((delta) => delta.value !== 0);
  const bondDelta = nextRelationshipState.bondXp - previousRelationshipState.bondXp;
  const deltas = [
    ...careDeltas,
    ...(bondDelta !== 0
      ? [
          {
            label: getLocalizedText(locale, { "en-US": "Bond", "ko-KR": "유대감", "ja-JP": "絆", "zh-TW": "感情", "de-DE": "Bindung", "fr-FR": "Complicité", "pt-BR": "Vínculo", "es-MX": "Vínculo" }),
            value: bondDelta
          }
        ]
      : [])
  ];
  const rewardLine = reward ? getRewardLine(reward, locale) : null;
  const visibleDeltas = deltas.slice(0, rewardLine ? 2 : 3);
  // Walk numbers read as a spreadsheet ("Path started · Mood +12 · Energy
  // -12"), which breaks the no-raw-numbers rule — tell it as a moment instead.
  const walkStartedLine = action === "walk" ? getLocalizedText(locale, { "en-US": "Mong trotted off to the path.", "ko-KR": "신나게 산책길로 출발했어요.", "ja-JP": "元気に小道へ出発しました。", "zh-TW": "開心地踏上小徑了。", "de-DE": "Mong ist fröhlich auf den Weg getrottet.", "fr-FR": "Mong est parti joyeusement sur le chemin.", "pt-BR": "Mong saiu trotando alegre pelo caminho.", "es-MX": "Mong salió feliz por el sendero." }) : null;
  const rhythmUpdatedLine = getLocalizedText(locale, { "en-US": "Care rhythm updated.", "ko-KR": "돌봄 리듬이 포근해졌어요.", "ja-JP": "お世話のリズムが心地よくなりました。", "zh-TW": "照顧節奏變得更溫暖了。", "de-DE": "Der Pflegerhythmus ist jetzt noch gemütlicher.", "fr-FR": "Le rythme des soins est devenu plus douillet.", "pt-BR": "O ritmo de cuidado ficou mais aconchegante.", "es-MX": "El ritmo de cuidados se volvió más cálido." });
  const line =
    walkStartedLine ??
    rewardLine ??
    (visibleDeltas.length > 0
      ? visibleDeltas.map(formatDelta).join(" · ")
      : rhythmUpdatedLine);
  const tone = getCareActionTone(action, deltas, reward ?? null);
  const accessibilityDetail =
    walkStartedLine ?? rewardLine ?? (deltas.length > 0 ? deltas.map(formatDelta).join(", ") : rhythmUpdatedLine);
  const feedbackTitle = getLocalizedText(locale, feedbackTitleByAction[action]);

  return {
    icon: reward ? "reward" : feedbackIconByAction[action],
    tone,
    title: feedbackTitle,
    line,
    deltas,
    accessibilityLabel: `${feedbackTitle}. ${accessibilityDetail}`
  };
};

const iconByStatusNeed: Record<PetStatusNeed, HomeThoughtIcon> = {
  fullness: "food",
  thirst: "water",
  mood: "toy",
  energy: "rest",
  clean: "clean",
  attention: "attention",
  cozy: "heart"
};

const getReactionIcon = (reaction: SelectedReaction): HomeThoughtIcon => {
  switch (reaction.category) {
    case "hungry_low":
    case "fed_recent":
    case "treat_common":
    case "treat_special":
      return "food";
    case "play_start":
    case "play_done":
      return "toy";
    case "garden_needs_water":
    case "garden_watered":
      return "water";
    case "energy_low":
    case "rested":
    case "greeting_night":
      return "rest";
    case "affection_low":
    case "premium_chat_teaser":
      return "attention";
    default:
      return "heart";
  }
};

// Sources selectPetStatusLine can return where nothing urgent or return-worthy
// is happening -- these are the only slots an episode line (memory recall /
// habit / weather-shift callback) is allowed to replace. Return greetings and
// urgent-need lines always win: an episode callback is a nice-to-have, never
// a reason to bury "I'm hungry" or "welcome back."
const AMBIENT_STATUS_SOURCES = new Set<PetStatusSource>(["weather_time", "reaction", "fallback"]);

// prototypeSession hands out priority 100 exclusively for its once-in-a-while
// celebration reactions (bond level-up, walk discovery, walk-journal
// complete -- see applyBondLevelRewards / claimPrototypeWalkReward); every
// starter/expanded reaction rule tops out at 97 (see
// mock/expandedReactionRules.ts). selectPetStatusLine's normal priority chain
// (return greeting > recent-action line > urgent need > weather/time > this
// reaction's own line) would otherwise bury a celebration line behind
// whichever generic per-action or weather line happens to be showing --
// exactly the bug this constant exists to route around: a celebration always
// wins the speech bubble outright, never competing with the ambient chain.
const CELEBRATION_REACTION_PRIORITY = 100;

/** True for the rare, once-off reactions (bond level-up, walk discoveries, walk-journal completion) that should own the speech bubble outright instead of competing with ambient/urgent-need copy. */
export const isCelebrationReaction = (reaction?: Pick<SelectedReaction, "priority"> | null): boolean =>
  (reaction?.priority ?? 0) >= CELEBRATION_REACTION_PRIORITY;

const localizedNeedThoughtByNeed: Readonly<Record<string, LocalizedText>> = {
  food: { "en-US": "My belly sent an official request for dinner.", "ko-KR": "배에서 꼬르륵 소리가 나요. 같이 밥 먹을까요?", "ja-JP": "おなかがぐうっと鳴りました。一緒にごはんにしませんか？", "zh-TW": "肚子咕嚕咕嚕叫了。要一起吃飯嗎？", "de-DE": "Mein Bauch knurrt leise. Essen wir zusammen?", "fr-FR": "Mon ventre gargouille doucement. On mange ensemble ?", "pt-BR": "Minha barriga roncou baixinho. Vamos comer juntos?", "es-MX": "Mi pancita está sonando. ¿Comemos juntos?" },
  thirst: { "en-US": "A fresh sip would feel nice.", "ko-KR": "신선한 물 한 모금이 필요해요.", "ja-JP": "新鮮なお水をひと口飲みたいな。", "zh-TW": "想喝一口新鮮的水。", "de-DE": "Ein frischer Schluck Wasser wäre schön.", "fr-FR": "Une petite gorgée d’eau fraîche serait agréable.", "pt-BR": "Um golinho de água fresca seria ótimo.", "es-MX": "Un traguito de agua fresca estaría muy bien." },
  rest: { "en-US": "I am a little sleepy. Can I rest near you?", "ko-KR": "조금 졸려요. 네 곁에서 쉬어도 될까요?", "ja-JP": "少し眠いな。そばで休んでもいい？", "zh-TW": "有點睏了。可以在你身邊休息嗎？", "de-DE": "Ich bin ein wenig müde. Darf ich mich bei dir ausruhen?", "fr-FR": "J’ai un peu sommeil. Je peux me reposer près de toi ?", "pt-BR": "Estou com um pouco de sono. Posso descansar perto de você?", "es-MX": "Tengo un poquito de sueño. ¿Puedo descansar cerca de ti?" },
  play: { "en-US": "I would love to play with you today.", "ko-KR": "오늘은 너와 신나게 놀고 싶어요.", "ja-JP": "今日は一緒に楽しく遊びたいな。", "zh-TW": "今天想和你一起開心玩耍。", "de-DE": "Heute würde ich so gern mit dir spielen.", "fr-FR": "J’aimerais beaucoup jouer avec toi aujourd’hui.", "pt-BR": "Quero muito brincar com você hoje.", "es-MX": "Hoy quiero jugar mucho contigo." },
  clean: { "en-US": "A warm bath would feel lovely.", "ko-KR": "따뜻하게 씻고 보송해지고 싶어요.", "ja-JP": "あたたかいお風呂でさっぱりしたいな。", "zh-TW": "想洗個暖暖的澡，變得清清爽爽。", "de-DE": "Ein warmes Bad würde sich wunderbar anfühlen.", "fr-FR": "Un bain bien chaud serait si agréable.", "pt-BR": "Um banho quentinho seria uma delícia.", "es-MX": "Un baño calientito se sentiría muy bien." },
  attention: { "en-US": "A gentle pet would make my heart feel cozy.", "ko-KR": "쓰다듬어 주면 마음이 포근해질 것 같아요.", "ja-JP": "なでてもらえたら、心がぽかぽかしそう。", "zh-TW": "摸摸我的話，心裡一定會暖暖的。", "de-DE": "Ein sanftes Streicheln würde mein Herz ganz warm machen.", "fr-FR": "Une douce caresse réchaufferait mon cœur.", "pt-BR": "Um carinho gentil deixaria meu coração quentinho.", "es-MX": "Una caricia suave haría sentir calientito mi corazón." }
};

const localizedActionThoughtByAction: Record<CareActionType, LocalizedText> = {
  feed: { "en-US": "Thank you for the tasty meal!", "ko-KR": "맛있는 밥 고마워요!", "ja-JP": "おいしいごはんをありがとう！", "zh-TW": "謝謝你準備好吃的飯！", "de-DE": "Danke für das leckere Essen!", "fr-FR": "Merci pour ce bon repas !", "pt-BR": "Obrigado pela comida gostosa!", "es-MX": "¡Gracias por la comida rica!" },
  talk: { "en-US": "Your voice makes me feel calm.", "ko-KR": "네 목소리를 들으면 마음이 편안해져요.", "ja-JP": "あなたの声を聞くと安心します。", "zh-TW": "聽到你的聲音，心裡就很安心。", "de-DE": "Deine Stimme macht mich ganz ruhig.", "fr-FR": "Ta voix m’apaise.", "pt-BR": "Sua voz me deixa tranquilo.", "es-MX": "Tu voz me hace sentir en calma." },
  walk: { "en-US": "I love our time on the path together.", "ko-KR": "함께 걷는 시간이 정말 좋아요.", "ja-JP": "一緒に歩く時間が大好きです。", "zh-TW": "最喜歡和你一起散步的時光。", "de-DE": "Ich liebe unsere gemeinsame Zeit auf dem Weg.", "fr-FR": "J’adore nos promenades ensemble.", "pt-BR": "Adoro nosso tempo juntos no caminho.", "es-MX": "Me encanta caminar contigo." },
  play: { "en-US": "Playing together was so much fun!", "ko-KR": "같이 놀아서 정말 신나요!", "ja-JP": "一緒に遊べてとっても楽しかった！", "zh-TW": "一起玩真的好開心！", "de-DE": "Zusammen zu spielen hat so viel Spaß gemacht!", "fr-FR": "C’était si amusant de jouer ensemble !", "pt-BR": "Foi tão divertido brincar junto!", "es-MX": "¡Fue muy divertido jugar juntos!" },
  rest: { "en-US": "Now I can rest all cozy.", "ko-KR": "이제 포근하게 쉴 수 있어요.", "ja-JP": "これで心地よく休めます。", "zh-TW": "現在可以舒服地休息了。", "de-DE": "Jetzt kann ich mich ganz gemütlich ausruhen.", "fr-FR": "Je peux maintenant me reposer bien au chaud.", "pt-BR": "Agora posso descansar bem aconchegado.", "es-MX": "Ahora puedo descansar muy a gusto." },
  affection: { "en-US": "I love your warm touch.", "ko-KR": "따뜻한 손길이 정말 좋아요.", "ja-JP": "あたたかい手が大好きです。", "zh-TW": "最喜歡你溫暖的手。", "de-DE": "Ich liebe deine warme Berührung.", "fr-FR": "J’adore la douceur de ta main.", "pt-BR": "Adoro seu carinho quentinho.", "es-MX": "Me encanta tu cariño cálido." },
  water_garden: { "en-US": "Thank you for the fresh water!", "ko-KR": "신선한 물 고마워요!", "ja-JP": "新鮮なお水をありがとう！", "zh-TW": "謝謝你的新鮮水！", "de-DE": "Danke für das frische Wasser!", "fr-FR": "Merci pour l’eau fraîche !", "pt-BR": "Obrigado pela água fresca!", "es-MX": "¡Gracias por el agua fresca!" },
  clean: { "en-US": "I feel so fresh and fluffy.", "ko-KR": "보송보송해져서 기분이 좋아요.", "ja-JP": "ふわふわさっぱりして、いい気分。", "zh-TW": "變得蓬鬆清爽，心情真好。", "de-DE": "Ich fühle mich so frisch und flauschig.", "fr-FR": "Je me sens tout frais et tout doux.", "pt-BR": "Estou tão limpinho e fofinho.", "es-MX": "Me siento fresco y esponjoso." },
  treat: { "en-US": "Thank you for the tasty treat!", "ko-KR": "맛있는 간식 고마워요!", "ja-JP": "おいしいおやつをありがとう！", "zh-TW": "謝謝你給我好吃的點心！", "de-DE": "Danke für das leckere Leckerli!", "fr-FR": "Merci pour cette délicieuse friandise !", "pt-BR": "Obrigado pelo petisco gostoso!", "es-MX": "¡Gracias por el premio tan rico!" }
};

export const getHomeThoughtPresentation = ({
  petName,
  reaction,
  satisfactionSummary,
  careState,
  weather,
  now = "2026-06-24T09:00:00.000Z",
  recentAction,
  daysAway,
  episodeLine,
  preferEpisodeLine = false,
  isShowingNightCareAcknowledgement = false,
  momentOverrideLine = null,
  locale = "en-US"
}: {
  petName: string;
  reaction: SelectedReaction;
  satisfactionSummary: Pick<CareSatisfactionSummary, "primaryNeed" | "hint">;
  careState?: Pick<CareState, "satiety" | "happiness" | "energy" | "gardenHealth" | "cleanliness" | "affection" | "lastInteractionAt" | "updatedAt">;
  weather?: WeatherContext | null;
  now?: string;
  recentAction?: CareActionType | null;
  daysAway?: number;
  /** A candidate episode line (memory recall / habit / weather-shift) -- only used when there's no urgent need or return greeting to show, and only when `preferEpisodeLine` says this is the moment for it. */
  episodeLine?: SelectedEpisodeLine | null;
  /** Caller's decision (first bubble of the session, or a seeded ~30-40% roll) on whether *this* render should prefer the episode line over ambient/fallback copy. */
  preferEpisodeLine?: boolean;
  /** True for the brief window right after a night-time (22:00-06:00) care tap -- see NIGHT_CARE_ACKNOWLEDGEMENT_LINE. Wins the bubble the same way a celebration reaction does, but never persists past that window (no penalty, no guilt, per the healing-app tone). */
  isShowingNightCareAcknowledgement?: boolean;
  /** A one-shot moment line (currently: catching the Tier 3 butterfly visitor) that owns the bubble outright for its brief window -- checked ahead of the night-care line since it's the rarer, more special moment of the two. Pass null when no such moment is active. */
  momentOverrideLine?: string | null;
  locale?: AppLocale;
}): HomeThoughtPresentation => {
  const status = selectPetStatusLine({
    petName,
    reaction,
    satisfactionSummary,
    careState,
    weather,
    now,
    recentAction,
    daysAway,
    surface: "home"
  });
  const need = satisfactionSummary.primaryNeed;
  const needCopy = need ? localizedNeedThoughtByNeed[need] : undefined;
  const celebrationIsShowing = isCelebrationReaction(reaction);
  const momentIsShowing = !celebrationIsShowing && Boolean(momentOverrideLine);
  const nightCareIsShowing = !celebrationIsShowing && !momentIsShowing && isShowingNightCareAcknowledgement;
  const episodeIsShowing = !celebrationIsShowing && !momentIsShowing && !nightCareIsShowing && Boolean(episodeLine && preferEpisodeLine && AMBIENT_STATUS_SOURCES.has(status.source));
  const lineCopy: LocalizedText = celebrationIsShowing
    ? { "en-US": reaction.line, "ko-KR": "오늘 우리 사이가 한층 더 가까워졌어요!", "ja-JP": "今日、ふたりの絆がもっと深まりました！", "zh-TW": "今天我們又更親近了一點！", "de-DE": "Heute sind wir uns noch näher gekommen!", "fr-FR": "Aujourd’hui, nous nous sommes encore rapprochés !", "pt-BR": "Hoje ficamos ainda mais próximos!", "es-MX": "¡Hoy nos volvimos aún más cercanos!" }
    : momentIsShowing ? { "en-US": momentOverrideLine ?? "", "ko-KR": "나비가 인사하러 왔어요!", "ja-JP": "ちょうちょがあいさつに来ました！", "zh-TW": "蝴蝶來打招呼了！", "de-DE": "Ein Schmetterling ist zum Grüßen gekommen!", "fr-FR": "Un papillon est venu dire bonjour !", "pt-BR": "Uma borboleta veio dar oi!", "es-MX": "¡Una mariposa vino a saludar!" }
    : nightCareIsShowing ? { "en-US": NIGHT_CARE_ACKNOWLEDGEMENT_LINE, "ko-KR": "고마워요. 이제 포근하게 다시 잘게요.", "ja-JP": "ありがとう。もう一度ぬくぬく眠るね。", "zh-TW": "謝謝你。我現在要暖暖地繼續睡了。", "de-DE": "Danke. Jetzt kuschle ich mich wieder in den Schlaf.", "fr-FR": "Merci. Je vais me rendormir bien au chaud.", "pt-BR": "Obrigado. Agora vou voltar a dormir bem aconchegado.", "es-MX": "Gracias. Ahora volveré a dormir muy a gusto." }
    : (daysAway ?? 0) > 0 ? { "en-US": status.line, "ko-KR": "{petName}가 돌아오길 기다렸어요. 다시 만나서 정말 좋아요!", "ja-JP": "{petName}はあなたを待っていました。帰ってきてくれてとってもうれしい！", "zh-TW": "{petName} 一直在等你。你回來真是太好了！", "de-DE": "{petName} hat auf dich gewartet. Wie schön, dass du wieder da bist!", "fr-FR": "{petName} vous attendait. Quel bonheur de vous retrouver !", "pt-BR": "{petName} estava esperando você. Que bom ter você de volta!", "es-MX": "{petName} te estuvo esperando. ¡Qué alegría tenerte de vuelta!" }
    : recentAction ? { ...localizedActionThoughtByAction[recentAction], "en-US": status.line }
    : needCopy ? { ...needCopy, "en-US": status.line }
    : episodeIsShowing ? { "en-US": episodeLine?.line ?? status.line, "ko-KR": "우리의 작은 추억 하나가 문득 떠올랐어요.", "ja-JP": "ふたりの小さな思い出をふと思い出しました。", "zh-TW": "忽然想起我們的一段小回憶。", "de-DE": "Gerade ist mir eine unserer kleinen Erinnerungen eingefallen.", "fr-FR": "Un de nos petits souvenirs vient de me revenir.", "pt-BR": "Acabei de lembrar de um dos nossos pequenos momentos.", "es-MX": "Acabo de recordar uno de nuestros pequeños momentos." }
    : { "en-US": status.line, "ko-KR": "오늘도 네 곁에서 천천히 쉬고 싶어요.", "ja-JP": "今日もあなたのそばで、のんびり休みたいな。", "zh-TW": "今天也想在你身邊慢慢休息。", "de-DE": "Heute möchte ich wieder ganz in Ruhe bei dir sein.", "fr-FR": "Aujourd’hui encore, j’aimerais me reposer doucement près de toi.", "pt-BR": "Hoje também quero descansar devagar ao seu lado.", "es-MX": "Hoy también quiero descansar tranquilamente a tu lado." };
  const line = getLocalizedText(locale, lineCopy).replaceAll("{petName}", petName);
  const englishAccessibilityLabel = nightCareIsShowing
    ? `${petName} sleepily thanks you and settles back down. ${NIGHT_CARE_ACKNOWLEDGEMENT_LINE}`
    : episodeIsShowing ? episodeLine?.line ?? status.accessibilityLabel
    : celebrationIsShowing || momentIsShowing ? lineCopy["en-US"]
    : status.accessibilityLabel;
  const accessibilityLabel = getLocalizedText(locale, { ...lineCopy, "en-US": englishAccessibilityLabel }).replaceAll("{petName}", petName);

  return {
    icon: celebrationIsShowing ? getReactionIcon(reaction) : momentIsShowing || nightCareIsShowing || episodeIsShowing ? "heart" : status.source === "reaction" ? getReactionIcon(reaction) : iconByStatusNeed[status.need],
    line,
    accessibilityLabel
  };
};

export const getHomeWalkCtaPresentation = (
  activeWalk: WalkSession | null,
  petName: string,
  secondsLeft: number,
  locale: AppLocale = "en-US"
): HomeWalkCtaPresentation => {
  const safeSecondsLeft = Math.max(0, secondsLeft);
  const pathLabel = getLocalizedText(locale, { "en-US": "Path", "ko-KR": "산책길", "ja-JP": "小道", "zh-TW": "小徑", "de-DE": "Weg", "fr-FR": "Chemin", "pt-BR": "Caminho", "es-MX": "Sendero" });
  if (!activeWalk || activeWalk.status === "claimed" || activeWalk.status === "expired") {
    return {
      status: "start",
      label: pathLabel,
      line: getLocalizedText(locale, { "en-US": "{petName} can take a tiny walk.", "ko-KR": "{petName}와 작은 산책을 떠날 수 있어요.", "ja-JP": "{petName}と小さなお散歩に出かけられます。", "zh-TW": "可以和 {petName} 去一趟迷你散步。", "de-DE": "{petName} kann einen kleinen Spaziergang machen.", "fr-FR": "{petName} peut faire une petite promenade.", "pt-BR": "{petName} pode fazer um pequeno passeio.", "es-MX": "{petName} puede dar un pequeño paseo." }).replaceAll("{petName}", petName),
      accessibilityLabel: getLocalizedText(locale, { "en-US": "Start a tiny walk with {petName}.", "ko-KR": "{petName}와 작은 산책 시작하기", "ja-JP": "{petName}と小さなお散歩を始める", "zh-TW": "和 {petName} 開始迷你散步", "de-DE": "Einen kleinen Spaziergang mit {petName} beginnen.", "fr-FR": "Commencer une petite promenade avec {petName}.", "pt-BR": "Começar um pequeno passeio com {petName}.", "es-MX": "Iniciar un pequeño paseo con {petName}." }).replaceAll("{petName}", petName)
    };
  }

  if (activeWalk.status === "walking") {
    return {
      status: "walking",
      label: getLocalizedText(locale, { "en-US": `${safeSecondsLeft}s`, "ko-KR": `${safeSecondsLeft}초`, "ja-JP": `${safeSecondsLeft}秒`, "zh-TW": `${safeSecondsLeft} 秒`, "de-DE": `${safeSecondsLeft}s`, "fr-FR": `${safeSecondsLeft}s`, "pt-BR": `${safeSecondsLeft}s`, "es-MX": `${safeSecondsLeft}s` }),
      line: getLocalizedText(locale, { "en-US": "{petName} is already on the path.", "ko-KR": "{petName}가 산책 중이에요.", "ja-JP": "{petName}はお散歩中です。", "zh-TW": "{petName} 正在散步。", "de-DE": "{petName} ist schon unterwegs.", "fr-FR": "{petName} est déjà en promenade.", "pt-BR": "{petName} já está passeando.", "es-MX": "{petName} ya está de paseo." }).replaceAll("{petName}", petName),
      accessibilityLabel: getLocalizedText(locale, { "en-US": "{petName} is walking. Returning in {seconds} seconds.", "ko-KR": "{petName}가 산책 중이며 {seconds}초 뒤에 돌아와요.", "ja-JP": "{petName}はお散歩中です。あと{seconds}秒で戻ります。", "zh-TW": "{petName} 正在散步，會在 {seconds} 秒後回來。", "de-DE": "{petName} ist unterwegs und in {seconds} Sekunden zurück.", "fr-FR": "{petName} se promène et revient dans {seconds} secondes.", "pt-BR": "{petName} está passeando e volta em {seconds} segundos.", "es-MX": "{petName} está de paseo y vuelve en {seconds} segundos." }).replaceAll("{petName}", petName).replaceAll("{seconds}", String(safeSecondsLeft))
    };
  }

  if (activeWalk.status === "returned") {
    return {
      status: "start",
      label: pathLabel,
      line: getLocalizedText(locale, { "en-US": "{petName} came back refreshed.", "ko-KR": "{petName}가 상쾌하게 돌아왔어요.", "ja-JP": "{petName}がさっぱりした顔で帰ってきました。", "zh-TW": "{petName} 神清氣爽地回來了。", "de-DE": "{petName} ist erfrischt zurück.", "fr-FR": "{petName} est revenu tout revigoré.", "pt-BR": "{petName} voltou revigorado.", "es-MX": "{petName} volvió renovado." }).replaceAll("{petName}", petName),
      accessibilityLabel: getLocalizedText(locale, { "en-US": "Start another tiny walk with {petName}.", "ko-KR": "{petName}와 또 작은 산책 시작하기", "ja-JP": "{petName}ともう一度小さなお散歩を始める", "zh-TW": "再和 {petName} 開始一次迷你散步", "de-DE": "Noch einen kleinen Spaziergang mit {petName} beginnen.", "fr-FR": "Commencer une autre petite promenade avec {petName}.", "pt-BR": "Começar outro pequeno passeio com {petName}.", "es-MX": "Iniciar otro pequeño paseo con {petName}." }).replaceAll("{petName}", petName)
    };
  }

  return {
    status: "hidden",
    label: "",
    line: "",
    accessibilityLabel: ""
  };
};

export const getHomeWalkPanelVisibility = ({
  activeWalk: _activeWalk,
  hasClaimedWalkReward: _hasClaimedWalkReward,
  rewardNoticeDismissed: _rewardNoticeDismissed
}: {
  activeWalk: WalkSession | null;
  hasClaimedWalkReward: boolean;
  rewardNoticeDismissed: boolean;
}): HomeWalkPanelVisibility => {
  return {
    shouldShowClaimedWalkRewardNotice: false,
    showCareDock: true
  };
};

/** Fires once the moment today's first care lands — never an always-on badge. */
export const getHomeStreakTogglePresentation = (streakDays: number, locale: AppLocale = "en-US"): HomeEventTogglePresentation | null => {
  if (streakDays <= 0) {
    return null;
  }

  const line = getLocalizedText(locale, streakDays === 1
    ? { "en-US": "Day 1 of your care streak! Off to a warm start.", "ko-KR": "연속 돌봄 첫날이에요! 포근하게 시작했어요.", "ja-JP": "連続お世話の1日目！あたたかなスタートです。", "zh-TW": "連續照顧第 1 天！暖暖地開始了。", "de-DE": "Tag 1 eurer Pflegeserie! Ein warmer Anfang.", "fr-FR": "Jour 1 de votre série de soins ! Un début tout doux.", "pt-BR": "Dia 1 da sua sequência de cuidados! Um começo quentinho.", "es-MX": "¡Día 1 de tu racha de cuidados! Un inicio cálido." }
    : { "en-US": `${streakDays} days in a row. This little garden loves the rhythm.`, "ko-KR": `${streakDays}일 연속으로 함께했어요. 작은 정원이 이 리듬을 좋아해요.`, "ja-JP": `${streakDays}日連続です。小さな庭もこのリズムが大好きです。`, "zh-TW": `連續陪伴 ${streakDays} 天了。小花園很喜歡這個節奏。`, "de-DE": `${streakDays} Tage in Folge. Der kleine Garten liebt diesen Rhythmus.`, "fr-FR": `${streakDays} jours de suite. Le petit jardin adore ce rythme.`, "pt-BR": `${streakDays} dias seguidos. O pequeno jardim adora esse ritmo.`, "es-MX": `${streakDays} días seguidos. Al pequeño jardín le encanta este ritmo.` });

  return {
    id: `streak-${streakDays}`,
    line,
    accessibilityLabel: getLocalizedText(locale, { "en-US": `Care streak: ${streakDays} day${streakDays === 1 ? "" : "s"} in a row.`, "ko-KR": `연속 돌봄 ${streakDays}일`, "ja-JP": `連続お世話${streakDays}日目。`, "zh-TW": `連續照顧 ${streakDays} 天。`, "de-DE": `Pflegeserie: ${streakDays} Tage in Folge.`, "fr-FR": `Série de soins : ${streakDays} jours de suite.`, "pt-BR": `Sequência de cuidados: ${streakDays} dias seguidos.`, "es-MX": `Racha de cuidados: ${streakDays} días seguidos.` })
  };
};

const buffLabelById: Readonly<Record<string, LocalizedText>> = {
  buff_full_belly: { "en-US": "Full belly", "ko-KR": "든든한 배", "ja-JP": "満腹のおなか", "zh-TW": "飽飽肚子", "de-DE": "Satter Bauch", "fr-FR": "Ventre bien rempli", "pt-BR": "Barriga cheia", "es-MX": "Pancita llena" },
  buff_favorite_toy: { "en-US": "Favorite toy", "ko-KR": "최애 장난감", "ja-JP": "お気に入りのおもちゃ", "zh-TW": "最愛玩具", "de-DE": "Lieblingsspielzeug", "fr-FR": "Jouet préféré", "pt-BR": "Brinquedo favorito", "es-MX": "Juguete favorito" },
  buff_cozy_cushion: { "en-US": "Cozy cushion", "ko-KR": "포근한 쿠션", "ja-JP": "ふかふかクッション", "zh-TW": "舒適靠墊", "de-DE": "Kuscheliges Kissen", "fr-FR": "Coussin douillet", "pt-BR": "Almofada aconchegante", "es-MX": "Cojín acogedor" },
  buff_training_treat: { "en-US": "Bond boost", "ko-KR": "유대 부스트", "ja-JP": "絆ブースト", "zh-TW": "感情加成", "de-DE": "Bindungsschub", "fr-FR": "Élan de complicité", "pt-BR": "Impulso de vínculo", "es-MX": "Impulso de vínculo" }
};

/** Fires once the instant a buff is granted — no persistent chip. */
export const getHomeBuffTogglePresentation = (
  buff: Pick<ActiveCareBuff, "buffId" | "labelEn"> & { readonly labelKo?: string },
  locale: AppLocale = "en-US"
): HomeEventTogglePresentation => {
  const knownLabel = buffLabelById[buff.buffId] ?? { "en-US": "Care boost", "ko-KR": "돌봄 부스트", "ja-JP": "お世話ブースト", "zh-TW": "照顧加成", "de-DE": "Pflegebonus", "fr-FR": "Bonus de soin", "pt-BR": "Impulso de cuidado", "es-MX": "Impulso de cuidado" };
  const label = getLocalizedText(locale, { ...knownLabel, "en-US": buff.labelEn, "ko-KR": buff.labelKo ?? knownLabel["ko-KR"] });

  return {
    id: buff.buffId,
    line: getLocalizedText(locale, { "en-US": `${label} is active!`, "ko-KR": `${label} 효과가 시작됐어요!`, "ja-JP": `${label}の効果が始まりました！`, "zh-TW": `${label}效果開始了！`, "de-DE": `${label} ist aktiv!`, "fr-FR": `${label} est actif !`, "pt-BR": `${label} está ativo!`, "es-MX": `¡${label} está activo!` }),
    accessibilityLabel: getLocalizedText(locale, { "en-US": `${label} effect just started.`, "ko-KR": `${label} 효과가 시작됐어요.`, "ja-JP": `${label}の効果が始まりました。`, "zh-TW": `${label}效果剛剛開始。`, "de-DE": `Der Effekt ${label} hat gerade begonnen.`, "fr-FR": `L’effet ${label} vient de commencer.`, "pt-BR": `O efeito ${label} acabou de começar.`, "es-MX": `El efecto ${label} acaba de comenzar.` })
  };
};

/** True when both timestamps fall on the same local calendar day. */
const isSameCalendarDay = (aIso: string, bIso: string): boolean => {
  const a = new Date(aIso);
  const b = new Date(bIso);

  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) {
    return false;
  }

  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
};

/** Celebration copy per D7/D14/D30 days-together milestone -- the 30-day toast points to the friend page letter rather than repeating the letter's own text. */
const daysMilestoneToastLineByDays: Record<number, LocalizedText> = {
  7: { "en-US": "A whole week together.", "ko-KR": "함께한 지 벌써 일주일이에요.", "ja-JP": "一緒に過ごして1週間。", "zh-TW": "一起度過整整一週了。", "de-DE": "Eine ganze Woche zusammen.", "fr-FR": "Une semaine entière ensemble.", "pt-BR": "Uma semana inteira juntos.", "es-MX": "Una semana completa juntos." },
  14: { "en-US": "Two weeks of little hellos.", "ko-KR": "작은 인사를 나눈 지 두 주가 됐어요.", "ja-JP": "小さなあいさつを重ねて2週間。", "zh-TW": "小小問候累積兩週了。", "de-DE": "Zwei Wochen voller kleiner Grüße.", "fr-FR": "Deux semaines de petits bonjours.", "pt-BR": "Duas semanas de pequenos olás.", "es-MX": "Dos semanas de pequeños saludos." },
  30: { "en-US": "One month. {name} left you a letter.", "ko-KR": "한 달을 함께했어요. {name}가 편지를 남겼어요.", "ja-JP": "一緒に過ごして1か月。{name}が手紙を残しました。", "zh-TW": "一起滿一個月了。{name} 留了一封信給你。", "de-DE": "Ein Monat. {name} hat dir einen Brief hinterlassen.", "fr-FR": "Un mois. {name} vous a laissé une lettre.", "pt-BR": "Um mês. {name} deixou uma carta para você.", "es-MX": "Un mes. {name} te dejó una carta." }
};

/**
 * Fires once, the day a D7/D14/D30 "days_milestone" memory is first recorded
 * (occurredAt falling on the same calendar day as `now`) -- never replays on
 * later visits, since a memory recorded yesterday no longer matches "today".
 * Returns null for milestone counts this feature doesn't have copy for, or
 * for a milestone recorded on any day other than today.
 */
export const getDaysMilestoneTogglePresentation = (
  memory: Pick<MemoryEntry, "type" | "occurredAt" | "refs">,
  petName: string,
  now: string,
  locale: AppLocale = "en-US"
): HomeEventTogglePresentation | null => {
  if (memory.type !== "days_milestone") {
    return null;
  }

  const daysTogether = memory.refs?.daysTogether;
  const lineTemplate = daysTogether !== undefined ? daysMilestoneToastLineByDays[daysTogether] : undefined;

  if (!lineTemplate) {
    return null;
  }

  if (!isSameCalendarDay(memory.occurredAt, now)) {
    return null;
  }

  const line = getLocalizedText(locale, lineTemplate).replaceAll("{name}", petName);

  return {
    id: `days-milestone-${daysTogether}`,
    line,
    accessibilityLabel: getLocalizedText(locale, { "en-US": `Milestone reached: ${line}`, "ko-KR": `함께한 날 기념: ${line}`, "ja-JP": `一緒に過ごした記念日：${line}`, "zh-TW": `陪伴里程碑：${line}`, "de-DE": `Meilenstein erreicht: ${line}`, "fr-FR": `Étape franchie : ${line}`, "pt-BR": `Marco alcançado: ${line}`, "es-MX": `Hito alcanzado: ${line}` })
  };
};

/**
 * Storage key for "already showed this days-together milestone's toast",
 * keyed by the milestone count itself (7/14/30) so each one only ever fires
 * once regardless of app restarts on the same day.
 */
export const getDaysMilestoneToastPersistedKey = (daysTogether: number): string => `days-milestone:${daysTogether}`;

/**
 * Whether the friend-page entry point should show its small unread-letter
 * badge dot: only once the pet has reached the 30-day letter, and only until
 * the owner has opened it.
 */
export const getFriendEntryBadgeVisible = (daysTogether: number, hasOpenedMonthlyLetter: boolean): boolean =>
  daysTogether >= 30 && !hasOpenedMonthlyLetter;

const EVENT_TOAST_PERSISTED_KEYS_LIMIT = 50;

/**
 * Storage key for "already showed today's streak toast", so a restart on the
 * same local day does not replay it. One key per day, not per streak length —
 * a longer streak later the same day is still a fresh moment worth a toast.
 */
export const getStreakToastPersistedKey = (dayKey: string): string => `streak:${dayKey}`;

/**
 * Storage key for "already showed this buff grant's toast". Keyed by the
 * grant instance (`startedAt`), not just the buff type, so re-granting the
 * same buff later still gets its own toast — only a true duplicate render of
 * the same grant is suppressed.
 */
export const getBuffToastPersistedKey = (buffId: string, startedAt: string): string => `buff:${buffId}:${startedAt}`;

/**
 * Fires once each time relationshipState.bondLevel crosses upward (see the
 * bondLevel-watching effect in TerrariumHomeScreen) -- the level-up itself
 * already lands a `bond_level_up_*` celebration reaction in the speech
 * bubble (see isCelebrationReaction), but that bubble line is transient and
 * tied to whichever care action triggered it. This toast is the persistent,
 * always-fired-once companion so a level-up is never missed just because the
 * bubble had already moved on. Mentions a reward only in the warm,
 * number-free way the rest of this file uses -- never "you got 5 credits."
 */
export const getBondLevelUpTogglePresentation = (level: number, locale: AppLocale = "en-US"): HomeEventTogglePresentation => {
  const reward = bondLevelRewards[level];
  const hasReward = Boolean(reward?.wallet || (reward?.items && reward.items.length > 0));
  const line = getLocalizedText(locale, hasReward
    ? { "en-US": `Lv ${level} — we're getting closer. A little something extra landed in your things.`, "ko-KR": `레벨 ${level} — 우리 사이가 더 가까워졌어요. 작은 선물도 보관함에 도착했어요.`, "ja-JP": `レベル${level} — もっと仲良くなりました。小さな贈り物も持ち物に届いています。`, "zh-TW": `等級 ${level} — 我們更親近了。還有一份小禮物送到收藏裡。`, "de-DE": `Lv ${level} — wir kommen uns näher. Eine kleine Überraschung ist auch in deinen Sachen gelandet.`, "fr-FR": `Niv. ${level} — nous nous rapprochons. Une petite surprise est aussi arrivée dans vos affaires.`, "pt-BR": `Nv. ${level} — estamos mais próximos. Uma pequena surpresa também chegou às suas coisas.`, "es-MX": `Nv. ${level} — estamos más cerca. También llegó una pequeña sorpresa a tus cosas.` }
    : { "en-US": `Lv ${level} — we're getting closer.`, "ko-KR": `레벨 ${level} — 우리 사이가 더 가까워졌어요.`, "ja-JP": `レベル${level} — もっと仲良くなりました。`, "zh-TW": `等級 ${level} — 我們更親近了。`, "de-DE": `Lv ${level} — wir kommen uns näher.`, "fr-FR": `Niv. ${level} — nous nous rapprochons.`, "pt-BR": `Nv. ${level} — estamos mais próximos.`, "es-MX": `Nv. ${level} — estamos más cerca.` });

  return {
    id: `bond-level-${level}`,
    line,
    accessibilityLabel: getLocalizedText(locale, {
      "en-US": `Bond level up: level ${level}. ${hasReward ? "A small reward arrived too." : ""}`.trim(),
      "ko-KR": `유대감 레벨 ${level} 달성. ${hasReward ? "작은 선물도 도착했어요." : ""}`.trim(),
      "ja-JP": `絆レベル${level}になりました。${hasReward ? "小さな贈り物も届きました。" : ""}`.trim(),
      "zh-TW": `感情等級提升到 ${level}。${hasReward ? "還收到一份小禮物。" : ""}`.trim(),
      "de-DE": `Bindungslevel ${level} erreicht. ${hasReward ? "Auch eine kleine Belohnung ist angekommen." : ""}`.trim(),
      "fr-FR": `Niveau de complicité ${level} atteint. ${hasReward ? "Une petite récompense est aussi arrivée." : ""}`.trim(),
      "pt-BR": `Nível de vínculo ${level} alcançado. ${hasReward ? "Uma pequena recompensa também chegou." : ""}`.trim(),
      "es-MX": `Nivel de vínculo ${level} alcanzado. ${hasReward ? "También llegó una pequeña recompensa." : ""}`.trim()
    })
  };
};

/** Storage key for "already showed this bond level's toast" -- one per level, since a level can only ever be crossed once per pet. */
export const getBondLevelToastPersistedKey = (level: number): string => `bond-level:${level}`;

/**
 * Fires once per newly-discovered walk collectible (see
 * claimPrototypeWalkReward's lastWalkDiscovery / discoveryReaction) -- a
 * small companion card underneath the bubble so the find is legible even if
 * the owner glances away before reading the speech bubble's own discovery
 * line. Rare finds get a slightly warmer accessibility label; no numbers.
 */
export const getWalkDiscoveryCardPresentation = (
  collectibleName: string,
  rarity: "common" | "rare",
  locale: AppLocale = "en-US"
): HomeEventTogglePresentation => ({
  id: `walk-discovery-${collectibleName}`,
  line: getLocalizedText(locale, { "en-US": `New find: ${collectibleName}`, "ko-KR": `새 발견: ${collectibleName}`, "ja-JP": `新しい発見：${collectibleName}`, "zh-TW": `新發現：${collectibleName}`, "de-DE": `Neuer Fund: ${collectibleName}`, "fr-FR": `Nouvelle trouvaille : ${collectibleName}`, "pt-BR": `Nova descoberta: ${collectibleName}`, "es-MX": `Nuevo hallazgo: ${collectibleName}` }),
  accessibilityLabel: getLocalizedText(locale, rarity === "rare"
    ? { "en-US": `New rare find: ${collectibleName}. This one is really special.`, "ko-KR": `새로운 희귀 발견물: ${collectibleName}. 정말 특별한 발견이에요.`, "ja-JP": `新しいレアな発見：${collectibleName}。とても特別なものです。`, "zh-TW": `新的稀有發現：${collectibleName}。這個真的很特別。`, "de-DE": `Neuer seltener Fund: ${collectibleName}. Dieser ist wirklich besonders.`, "fr-FR": `Nouvelle trouvaille rare : ${collectibleName}. Elle est vraiment spéciale.`, "pt-BR": `Nova descoberta rara: ${collectibleName}. Esta é muito especial.`, "es-MX": `Nuevo hallazgo raro: ${collectibleName}. Este es muy especial.` }
    : { "en-US": `New find: ${collectibleName}.`, "ko-KR": `새 발견물: ${collectibleName}.`, "ja-JP": `新しい発見：${collectibleName}。`, "zh-TW": `新發現：${collectibleName}。`, "de-DE": `Neuer Fund: ${collectibleName}.`, "fr-FR": `Nouvelle trouvaille : ${collectibleName}.`, "pt-BR": `Nova descoberta: ${collectibleName}.`, "es-MX": `Nuevo hallazgo: ${collectibleName}.` })
});

const walkCollectibleNameById: Readonly<Record<string, LocalizedText>> = {
  col_sunny_petal: { "en-US": "Sunny Petal", "ko-KR": "햇살 꽃잎", "ja-JP": "ひだまりの花びら", "zh-TW": "陽光花瓣", "de-DE": "Sonnenblüte", "fr-FR": "Pétale ensoleillé", "pt-BR": "Pétala ensolarada", "es-MX": "Pétalo soleado" },
  col_smooth_pebble: { "en-US": "Smooth Pebble", "ko-KR": "동글 조약돌", "ja-JP": "まるい小石", "zh-TW": "圓潤小石", "de-DE": "Glatter Kiesel", "fr-FR": "Galet tout rond", "pt-BR": "Pedrinha lisa", "es-MX": "Piedrita lisa" },
  col_rain_bead: { "en-US": "Rain Bead", "ko-KR": "빗방울 구슬", "ja-JP": "雨つぶビーズ", "zh-TW": "雨滴珠", "de-DE": "Regenperle", "fr-FR": "Perle de pluie", "pt-BR": "Conta de chuva", "es-MX": "Cuenta de lluvia" },
  col_shiny_leaf: { "en-US": "Shiny Leaf", "ko-KR": "반짝 잎사귀", "ja-JP": "きらきらの葉っぱ", "zh-TW": "閃亮葉片", "de-DE": "Glänzendes Blatt", "fr-FR": "Feuille brillante", "pt-BR": "Folha brilhante", "es-MX": "Hoja brillante" },
  col_frost_sparkle: { "en-US": "Frost Sparkle", "ko-KR": "서리 조각", "ja-JP": "霜のきらめき", "zh-TW": "霜晶", "de-DE": "Frostfunkeln", "fr-FR": "Éclat de givre", "pt-BR": "Brilho de geada", "es-MX": "Destello de escarcha" },
  col_wind_ribbon: { "en-US": "Wind Ribbon", "ko-KR": "바람 리본", "ja-JP": "風のリボン", "zh-TW": "風之緞帶", "de-DE": "Windband", "fr-FR": "Ruban du vent", "pt-BR": "Fita de vento", "es-MX": "Listón de viento" },
  col_warm_seed: { "en-US": "Warm Seed", "ko-KR": "햇볕 씨앗", "ja-JP": "あったかい種", "zh-TW": "暖陽種子", "de-DE": "Warmer Samen", "fr-FR": "Graine tiède", "pt-BR": "Semente quentinha", "es-MX": "Semilla cálida" },
  col_mist_feather: { "en-US": "Mist Feather", "ko-KR": "안개 깃털", "ja-JP": "霧の羽根", "zh-TW": "霧羽", "de-DE": "Nebelfeder", "fr-FR": "Plume de brume", "pt-BR": "Pena de névoa", "es-MX": "Pluma de niebla" },
  col_rainbow_shard: { "en-US": "Rainbow Shard", "ko-KR": "무지개 조각", "ja-JP": "虹のかけら", "zh-TW": "彩虹碎片", "de-DE": "Regenbogensplitter", "fr-FR": "Éclat d’arc-en-ciel", "pt-BR": "Fragmento de arco-íris", "es-MX": "Fragmento de arcoíris" }
};

export const getLocalizedWalkCollectibleName = (
  collectible: Pick<WalkCollectible, "id" | "nameEn" | "nameKo">,
  locale: AppLocale = "en-US"
): string => {
  const localizedName = walkCollectibleNameById[collectible.id] ?? { "en-US": collectible.nameEn, "ko-KR": collectible.nameKo, "ja-JP": "お散歩の宝物", "zh-TW": "散步寶物", "de-DE": "Spaziergangsschatz", "fr-FR": "Trésor de promenade", "pt-BR": "Tesouro do passeio", "es-MX": "Tesoro del paseo" };

  return getLocalizedText(locale, { ...localizedName, "en-US": collectible.nameEn, "ko-KR": collectible.nameKo });
};

/**
 * Fires once the moment the walk journal (9 collectibles) is completed (see
 * claimPrototypeWalkReward's collectionCompleted flag) -- names the reward
 * without a number so the "quietly credited" feeling the task brief calls
 * out gets a clear, warm acknowledgement instead.
 */
export const getWalkCollectionCompleteTogglePresentation = (locale: AppLocale = "en-US"): HomeEventTogglePresentation => ({
  id: "walk-collection-complete",
  line: getLocalizedText(locale, { "en-US": "Walk journal complete! A little thank-you went into your wallet.", "ko-KR": "산책 발견물 책을 모두 채웠어요! 감사 선물이 지갑에 도착했어요.", "ja-JP": "お散歩図鑑が完成！小さな感謝の贈り物がお財布に届きました。", "zh-TW": "散步圖鑑完成了！一份小小謝禮已送進錢包。", "de-DE": "Spaziergangstagebuch vollständig! Ein kleines Dankeschön ist in deiner Börse gelandet.", "fr-FR": "Carnet de promenade terminé ! Un petit merci est arrivé dans votre portefeuille.", "pt-BR": "Diário de passeio completo! Um pequeno agradecimento chegou à sua carteira.", "es-MX": "¡Diario de paseos completo! Un pequeño agradecimiento llegó a tu cartera." }),
  accessibilityLabel: getLocalizedText(locale, { "en-US": "Walk journal complete. A thank-you reward was added to your wallet.", "ko-KR": "산책 발견물 책 완성. 감사 선물이 지갑에 추가됐어요.", "ja-JP": "お散歩図鑑が完成しました。感謝の贈り物がお財布に追加されました。", "zh-TW": "散步圖鑑完成。謝禮已加入錢包。", "de-DE": "Spaziergangstagebuch vollständig. Eine Dankesbelohnung wurde deiner Börse hinzugefügt.", "fr-FR": "Carnet de promenade terminé. Une récompense de remerciement a été ajoutée à votre portefeuille.", "pt-BR": "Diário de passeio completo. Uma recompensa de agradecimento foi adicionada à sua carteira.", "es-MX": "Diario de paseos completo. Se agregó una recompensa de agradecimiento a tu cartera." })
});

/**
 * Fires once when an expression pack purchase finishes and its new assets
 * land in acceptedAssets (see purchaseExpressionPack's poll effect in
 * TerrariumSessionProvider) -- surfaced here rather than only on the friend
 * page, since the poll keeps running after navigating home. Returns null for
 * an unknown pack id so a stale/removed pack can never crash this toast.
 */
export const getExpressionPackUnlockedTogglePresentation = (packId: string, petName: string, locale: AppLocale = "en-US"): HomeEventTogglePresentation | null => {
  const pack = getExpressionPackById(packId);

  if (!pack) {
    return null;
  }

  const localizedPackNames: Readonly<Record<string, LocalizedText>> = {
    "pack-everyday-moments": { "en-US": "Everyday Moments", "ko-KR": "일상의 순간들", "ja-JP": "毎日のひととき", "zh-TW": "日常時光", "de-DE": "Alltagsmomente", "fr-FR": "Moments du quotidien", "pt-BR": "Momentos do dia a dia", "es-MX": "Momentos cotidianos" },
    "pack-care-reactions": { "en-US": "Care Reactions", "ko-KR": "돌봄 리액션", "ja-JP": "お世話リアクション", "zh-TW": "照顧反應", "de-DE": "Pflegereaktionen", "fr-FR": "Réactions aux soins", "pt-BR": "Reações de cuidado", "es-MX": "Reacciones de cuidado" },
    "pack-special-days": { "en-US": "Special Days", "ko-KR": "특별한 날", "ja-JP": "特別な日", "zh-TW": "特別日子", "de-DE": "Besondere Tage", "fr-FR": "Jours spéciaux", "pt-BR": "Dias especiais", "es-MX": "Días especiales" },
    "pack-tender-care": { "en-US": "Tender Care", "ko-KR": "다정한 돌봄", "ja-JP": "やさしいお世話", "zh-TW": "溫柔照顧", "de-DE": "Sanfte Pflege", "fr-FR": "Soins tendres", "pt-BR": "Cuidado carinhoso", "es-MX": "Cuidado cariñoso" }
  };
  const packName = getLocalizedText(locale, localizedPackNames[pack.id] ?? { "en-US": pack.nameEn, "ko-KR": pack.nameKo, "ja-JP": "表情パック", "zh-TW": "表情包", "de-DE": "Ausdruckspaket", "fr-FR": "Pack d’expressions", "pt-BR": "Pacote de expressões", "es-MX": "Paquete de expresiones" });

  return {
    id: `expression-pack-${packId}`,
    line: getLocalizedText(locale, { "en-US": `${petName} learned some new expressions!`, "ko-KR": `${petName}가 새로운 표정을 배웠어요!`, "ja-JP": `${petName}が新しい表情を覚えました！`, "zh-TW": `${petName} 學會了新的表情！`, "de-DE": `${petName} hat neue Ausdrücke gelernt!`, "fr-FR": `${petName} a appris de nouvelles expressions !`, "pt-BR": `${petName} aprendeu novas expressões!`, "es-MX": `¡${petName} aprendió nuevas expresiones!` }),
    accessibilityLabel: getLocalizedText(locale, { "en-US": `${petName} unlocked the ${packName} expression pack.`, "ko-KR": `${petName}가 ${packName} 표정 팩을 열었어요.`, "ja-JP": `${petName}が表情パック「${packName}」をアンロックしました。`, "zh-TW": `${petName} 解鎖了「${packName}」表情包。`, "de-DE": `${petName} hat das Ausdruckspaket „${packName}“ freigeschaltet.`, "fr-FR": `${petName} a débloqué le pack d’expressions « ${packName} ».`, "pt-BR": `${petName} desbloqueou o pacote de expressões ${packName}.`, "es-MX": `${petName} desbloqueó el paquete de expresiones ${packName}.` })
  };
};

/** Storage key for "already showed this expression pack's unlock toast" -- one per pack id, since a pack can only ever be purchased once. */
export const getExpressionPackToastPersistedKey = (packId: string): string => `expression-pack:${packId}`;

/**
 * Caps the persisted "shown toast" key list so it cannot grow forever across
 * app sessions. Keeps only the most recently added keys (assumes `keys` is
 * already in insertion order); oldest keys are dropped first.
 */
export const pruneEventToastPersistedKeys = (
  keys: readonly string[],
  limit: number = EVENT_TOAST_PERSISTED_KEYS_LIMIT
): string[] => (keys.length <= limit ? [...keys] : keys.slice(keys.length - limit));

/**
 * Care actions that resolve a given meter, in the order their icons should
 * appear in the guide popup -- reuses HomeCareActionFeedbackIcon's icon
 * vocabulary ("food"/"water"/"play"/"heart"/"rest") so the popup renders the
 * exact same art as the matching care buttons in the bottom tray
 * (careButtons/hudButtonAssets in TerrariumHomeScreen), never a new icon set.
 */
const hudMeterActionIconsByKey: Record<HudMeterKey, HomeCareActionFeedbackIcon[]> = {
  fullness: ["food"],
  thirst: ["water"],
  mood: ["play", "heart"],
  energy: ["rest", "food"],
  cleanliness: ["clean"]
};

export interface HudMeterGuideCopy {
  key: HudMeterKey;
  title: string;
  description: string;
  /** One-line "what fixes this" guidance, led with in the popup ahead of the status line -- see the redesign note on HudMeterGuidePresentation. */
  howTo: string;
}

const hudMeterGuideCopy: Record<HudMeterKey, { readonly key: HudMeterKey; readonly title: LocalizedText; readonly description: LocalizedText; readonly howTo: LocalizedText }> = {
  fullness: {
    key: "fullness",
    title: { "en-US": "Full", "ko-KR": "배부름", "ja-JP": "満腹", "zh-TW": "飽足", "de-DE": "Satt", "fr-FR": "Satiété", "pt-BR": "Saciedade", "es-MX": "Saciedad" },
    description: { "en-US": "How satisfied your pet's tummy is feeling.", "ko-KR": "우리 친구의 배가 얼마나 든든한지 보여줘요.", "ja-JP": "ペットのおなかがどれくらい満たされているかを表します。", "zh-TW": "顯示毛孩的肚子有多滿足。", "de-DE": "Zeigt, wie zufrieden sich der Bauch deines Tiers fühlt.", "fr-FR": "Indique à quel point le ventre de votre compagnon est rassasié.", "pt-BR": "Mostra o quanto a barriguinha do seu pet está satisfeita.", "es-MX": "Muestra qué tan satisfecha está la pancita de tu mascota." },
    howTo: { "en-US": "A good meal fills this right up.", "ko-KR": "맛있는 밥을 주면 든든하게 채워져요.", "ja-JP": "おいしいごはんで、しっかり満たされます。", "zh-TW": "一頓好吃的餐點就能補得滿滿的。", "de-DE": "Eine gute Mahlzeit füllt die Anzeige schnell auf.", "fr-FR": "Un bon repas remplit rapidement cette jauge.", "pt-BR": "Uma boa refeição enche isso rapidinho.", "es-MX": "Una buena comida llena esto enseguida." }
  },
  thirst: {
    key: "thirst",
    title: { "en-US": "Water", "ko-KR": "물", "ja-JP": "お水", "zh-TW": "水分", "de-DE": "Wasser", "fr-FR": "Eau", "pt-BR": "Água", "es-MX": "Agua" },
    description: { "en-US": "Fresh water keeps your buddy happily hydrated.", "ko-KR": "신선한 물은 우리 친구의 몸과 기분을 촉촉하게 해줘요.", "ja-JP": "新鮮なお水で、いきいき心地よく過ごせます。", "zh-TW": "新鮮的水讓毛孩開心又水潤。", "de-DE": "Frisches Wasser hält deinen Freund glücklich und gut versorgt.", "fr-FR": "De l’eau fraîche garde votre compagnon bien hydraté et heureux.", "pt-BR": "Água fresca mantém seu amiguinho feliz e hidratado.", "es-MX": "El agua fresca mantiene a tu amiguito feliz e hidratado." },
    howTo: { "en-US": "A fresh bowl of water tops this right off.", "ko-KR": "깨끗한 물 한 그릇을 채워주세요.", "ja-JP": "新鮮なお水を一杯あげると、すぐに潤います。", "zh-TW": "裝滿一碗新鮮的水，就能立刻補足。", "de-DE": "Ein Napf mit frischem Wasser füllt die Anzeige schnell auf.", "fr-FR": "Un bol d’eau fraîche remplit rapidement cette jauge.", "pt-BR": "Uma tigela de água fresca completa isso rapidinho.", "es-MX": "Un plato de agua fresca llena esto enseguida." }
  },
  mood: {
    key: "mood",
    title: { "en-US": "Mood", "ko-KR": "기분", "ja-JP": "気分", "zh-TW": "心情", "de-DE": "Laune", "fr-FR": "Humeur", "pt-BR": "Humor", "es-MX": "Ánimo" },
    description: { "en-US": "How happy and loved your pet feels right now.", "ko-KR": "지금 우리 친구가 얼마나 행복하고 사랑받는지 보여줘요.", "ja-JP": "今、ペットがどれくらい幸せで愛されていると感じているかを表します。", "zh-TW": "顯示毛孩現在有多開心、多感受到愛。", "de-DE": "Zeigt, wie glücklich und geliebt sich dein Tier gerade fühlt.", "fr-FR": "Indique à quel point votre compagnon se sent heureux et aimé.", "pt-BR": "Mostra o quanto seu pet se sente feliz e amado agora.", "es-MX": "Muestra qué tan feliz y querido se siente tu mascota ahora." },
    howTo: { "en-US": "A little play or a good pet lifts this fast.", "ko-KR": "함께 놀거나 쓰다듬어 주면 금방 좋아져요.", "ja-JP": "少し遊んだり、なでたりするとすぐ元気になります。", "zh-TW": "玩一下或摸摸牠，心情很快就會變好。", "de-DE": "Etwas Spielen oder Streicheln hebt die Laune schnell.", "fr-FR": "Un peu de jeu ou une caresse remonte vite le moral.", "pt-BR": "Um pouco de brincadeira ou carinho melhora isso rapidinho.", "es-MX": "Un poco de juego o una caricia mejora esto enseguida." }
  },
  energy: {
    key: "energy",
    title: { "en-US": "Energy", "ko-KR": "에너지", "ja-JP": "元気", "zh-TW": "精力", "de-DE": "Energie", "fr-FR": "Énergie", "pt-BR": "Energia", "es-MX": "Energía" },
    description: { "en-US": "How rested and ready to play your pet is.", "ko-KR": "얼마나 푹 쉬고 놀 준비가 됐는지 보여줘요.", "ja-JP": "どれくらい休めて、遊ぶ準備ができているかを表します。", "zh-TW": "顯示毛孩休息得多好、是否準備好玩耍。", "de-DE": "Zeigt, wie ausgeruht und spielbereit dein Tier ist.", "fr-FR": "Indique à quel point votre compagnon est reposé et prêt à jouer.", "pt-BR": "Mostra o quanto seu pet descansou e está pronto para brincar.", "es-MX": "Muestra qué tan descansada y lista para jugar está tu mascota." },
    howTo: { "en-US": "Some rest — or a good meal — brings this right back.", "ko-KR": "푹 쉬거나 든든하게 먹으면 다시 힘이 나요.", "ja-JP": "ゆっくり休むか、しっかり食べると元気が戻ります。", "zh-TW": "好好休息或吃頓好飯，就能恢復精力。", "de-DE": "Etwas Ruhe oder eine gute Mahlzeit bringt die Energie zurück.", "fr-FR": "Un peu de repos ou un bon repas redonne vite de l’énergie.", "pt-BR": "Um pouco de descanso ou uma boa refeição traz a energia de volta.", "es-MX": "Un poco de descanso o una buena comida devuelve la energía." }
  },
  cleanliness: {
    key: "cleanliness",
    title: { "en-US": "Clean", "ko-KR": "청결", "ja-JP": "清潔", "zh-TW": "清潔", "de-DE": "Sauber", "fr-FR": "Propreté", "pt-BR": "Limpeza", "es-MX": "Limpieza" },
    description: { "en-US": "How fresh and tidy your pet is feeling.", "ko-KR": "우리 친구가 얼마나 보송하고 깨끗한지 보여줘요.", "ja-JP": "ペットがどれくらいさっぱり清潔に感じているかを表します。", "zh-TW": "顯示毛孩現在有多清爽乾淨。", "de-DE": "Zeigt, wie frisch und sauber sich dein Tier fühlt.", "fr-FR": "Indique à quel point votre compagnon se sent frais et propre.", "pt-BR": "Mostra o quanto seu pet está limpinho e fresco.", "es-MX": "Muestra qué tan fresca y limpia se siente tu mascota." },
    howTo: { "en-US": "A warm bath freshens this right up.", "ko-KR": "따뜻하게 목욕하면 다시 보송해져요.", "ja-JP": "あたたかいお風呂ですぐにさっぱりします。", "zh-TW": "洗個暖暖的澡，很快就會清爽起來。", "de-DE": "Ein warmes Bad macht dein Tier schnell wieder frisch.", "fr-FR": "Un bain chaud rafraîchit rapidement votre compagnon.", "pt-BR": "Um banho quentinho deixa tudo fresco rapidinho.", "es-MX": "Un baño calientito refresca todo enseguida." }
  }
};

const hudMeterStatusLineByBand: Record<HudMeterKey, Record<CareStatBand, LocalizedText>> = {
  fullness: {
    critical: { "en-US": "Feeling quite empty — a meal would go a long way.", "ko-KR": "배가 많이 비어 보여요. 든든한 밥이 큰 도움이 될 거예요.", "ja-JP": "おなかがかなり空いているみたい。しっかりしたごはんがうれしいはずです。", "zh-TW": "肚子好像很空。一頓飽足的餐點會很有幫助。", "de-DE": "Der Bauch fühlt sich ziemlich leer an. Eine Mahlzeit würde sehr helfen.", "fr-FR": "Le ventre semble bien vide. Un bon repas ferait beaucoup de bien.", "pt-BR": "A barriguinha parece bem vazia. Uma boa refeição ajudaria muito.", "es-MX": "La pancita parece bastante vacía. Una buena comida ayudaría mucho." },
    low: { "en-US": "Getting a little hungry over here.", "ko-KR": "조금 배가 고픈 것 같아요.", "ja-JP": "少しおなかが空いてきました。", "zh-TW": "好像有一點餓了。", "de-DE": "Langsam kommt ein wenig Hunger auf.", "fr-FR": "Une petite faim commence à se faire sentir.", "pt-BR": "Está começando a dar um pouco de fome.", "es-MX": "Está empezando a dar un poco de hambre." },
    okay: { "en-US": "Comfortably fed for now.", "ko-KR": "지금은 배가 편안하게 든든해요.", "ja-JP": "今はちょうどよく満たされています。", "zh-TW": "現在肚子舒服又滿足。", "de-DE": "Im Moment angenehm satt.", "fr-FR": "Bien rassasié pour le moment.", "pt-BR": "Confortavelmente satisfeito por enquanto.", "es-MX": "Cómodamente satisfecho por ahora." },
    great: { "en-US": "Happily full and content.", "ko-KR": "행복하고 든든하게 배불러요.", "ja-JP": "おなかいっぱいで幸せそう。", "zh-TW": "吃得飽飽，心滿意足。", "de-DE": "Glücklich satt und zufrieden.", "fr-FR": "Heureux, rassasié et satisfait.", "pt-BR": "Feliz, satisfeito e de barriga cheia.", "es-MX": "Feliz, satisfecho y con la pancita llena." }
  },
  thirst: {
    critical: { "en-US": "Feeling quite parched — a fresh bowl would help a lot.", "ko-KR": "목이 많이 말라 보여요. 신선한 물이 큰 도움이 될 거예요.", "ja-JP": "喉がかなり渇いているみたい。新鮮なお水がうれしいはずです。", "zh-TW": "看起來很口渴。一碗新鮮的水會很有幫助。", "de-DE": "Ziemlich durstig. Ein Napf mit frischem Wasser würde sehr helfen.", "fr-FR": "Une grande soif se fait sentir. Un bol d’eau fraîche ferait beaucoup de bien.", "pt-BR": "Parece estar com bastante sede. Uma tigela de água fresca ajudaria muito.", "es-MX": "Parece tener mucha sed. Un plato de agua fresca ayudaría mucho." },
    low: { "en-US": "Getting a little thirsty over here.", "ko-KR": "조금 목이 마른 것 같아요.", "ja-JP": "少し喉が渇いてきました。", "zh-TW": "好像有一點口渴了。", "de-DE": "Langsam kommt ein wenig Durst auf.", "fr-FR": "Une petite soif commence à se faire sentir.", "pt-BR": "Está começando a dar um pouco de sede.", "es-MX": "Está empezando a dar un poco de sed." },
    okay: { "en-US": "Nicely hydrated.", "ko-KR": "촉촉하고 편안해요.", "ja-JP": "ちょうどよく潤っています。", "zh-TW": "水分充足，很舒服。", "de-DE": "Gut mit Wasser versorgt.", "fr-FR": "Bien hydraté.", "pt-BR": "Bem hidratado.", "es-MX": "Bien hidratado." },
    great: { "en-US": "Happily hydrated and refreshed.", "ko-KR": "신선한 물을 마셔서 기분까지 상쾌해요.", "ja-JP": "しっかり潤って、さっぱりごきげん。", "zh-TW": "水分滿滿，清爽又開心。", "de-DE": "Glücklich versorgt und erfrischt.", "fr-FR": "Bien hydraté, rafraîchi et heureux.", "pt-BR": "Hidratado, refrescado e feliz.", "es-MX": "Hidratado, fresco y feliz." }
  },
  mood: {
    critical: { "en-US": "Feeling a little low today — some attention would help.", "ko-KR": "오늘은 마음이 조금 가라앉았어요. 관심이 필요해요.", "ja-JP": "今日は少ししょんぼり。やさしく構ってもらえたらうれしいな。", "zh-TW": "今天心情有點低落。多一點陪伴會很有幫助。", "de-DE": "Heute etwas niedergeschlagen. Ein wenig Aufmerksamkeit würde helfen.", "fr-FR": "Le moral est un peu bas aujourd’hui. Un peu d’attention ferait du bien.", "pt-BR": "O humor está um pouco baixo hoje. Um pouco de atenção ajudaria.", "es-MX": "El ánimo está un poco bajo hoy. Un poco de atención ayudaría." },
    low: { "en-US": "Could use a small pick-me-up.", "ko-KR": "작은 즐거움이 있으면 좋겠어요.", "ja-JP": "小さな楽しいことがあるとうれしいな。", "zh-TW": "來一點小小的開心事就更好了。", "de-DE": "Eine kleine Aufmunterung wäre schön.", "fr-FR": "Un petit remontant serait bienvenu.", "pt-BR": "Um pequeno ânimo cairia bem.", "es-MX": "Un pequeño apapacho vendría bien." },
    okay: { "en-US": "Feeling good.", "ko-KR": "기분이 좋아요.", "ja-JP": "いい気分です。", "zh-TW": "心情很好。", "de-DE": "Fühlt sich gut an.", "fr-FR": "De bonne humeur.", "pt-BR": "Sentindo-se bem.", "es-MX": "Se siente bien." },
    great: { "en-US": "Absolutely glowing with happiness.", "ko-KR": "행복한 마음이 반짝반짝 빛나요.", "ja-JP": "幸せいっぱいで、きらきら輝いています。", "zh-TW": "幸福得閃閃發亮。", "de-DE": "Strahlt förmlich vor Glück.", "fr-FR": "Rayonne littéralement de bonheur.", "pt-BR": "Brilhando de tanta felicidade.", "es-MX": "Brilla por completo de felicidad." }
  },
  energy: {
    critical: { "en-US": "Running on empty — rest would help a lot.", "ko-KR": "힘이 거의 없어요. 푹 쉬면 좋아질 거예요.", "ja-JP": "元気を使い切ったみたい。ゆっくり休むと楽になります。", "zh-TW": "精力快用完了。好好休息會舒服很多。", "de-DE": "Die Energie ist fast aufgebraucht. Ruhe würde sehr helfen.", "fr-FR": "L’énergie est presque épuisée. Du repos ferait beaucoup de bien.", "pt-BR": "A energia está quase no fim. Descansar ajudaria muito.", "es-MX": "La energía está casi agotada. Descansar ayudaría mucho." },
    low: { "en-US": "A little tired.", "ko-KR": "조금 피곤해 보여요.", "ja-JP": "少し疲れています。", "zh-TW": "有一點累了。", "de-DE": "Ein wenig müde.", "fr-FR": "Un peu fatigué.", "pt-BR": "Um pouco cansado.", "es-MX": "Un poco cansado." },
    okay: { "en-US": "Feeling steady.", "ko-KR": "편안하고 안정적이에요.", "ja-JP": "落ち着いて元気です。", "zh-TW": "精力平穩，感覺舒服。", "de-DE": "Fühlt sich ausgeglichen an.", "fr-FR": "L’énergie est stable.", "pt-BR": "A energia está estável.", "es-MX": "La energía está estable." },
    great: { "en-US": "Bursting with energy.", "ko-KR": "에너지가 가득해요.", "ja-JP": "元気があふれています。", "zh-TW": "精力滿滿。", "de-DE": "Steckt voller Energie.", "fr-FR": "Déborde d’énergie.", "pt-BR": "Transbordando energia.", "es-MX": "Rebosando de energía." }
  },
  cleanliness: {
    critical: { "en-US": "Feeling pretty grubby — a bath would feel really nice.", "ko-KR": "조금 꼬질꼬질해졌어요. 따뜻한 목욕이 기분 좋을 것 같아요.", "ja-JP": "少し汚れてきました。あたたかいお風呂が気持ちよさそう。", "zh-TW": "有點灰撲撲了。洗個暖暖的澡一定很舒服。", "de-DE": "Etwas schmuddelig. Ein warmes Bad würde sich wunderbar anfühlen.", "fr-FR": "Un peu tout sale. Un bain chaud ferait vraiment du bien.", "pt-BR": "Está um pouco sujinho. Um banho quentinho seria uma delícia.", "es-MX": "Está un poco mugroso. Un baño calientito se sentiría muy bien." },
    low: { "en-US": "Getting a little dusty over here.", "ko-KR": "털에 먼지가 조금 묻었어요.", "ja-JP": "少しほこりっぽくなってきました。", "zh-TW": "身上沾了一點灰塵。", "de-DE": "Langsam wird es ein wenig staubig.", "fr-FR": "Un peu de poussière commence à s’installer.", "pt-BR": "Está ficando um pouco empoeirado.", "es-MX": "Se está poniendo un poco polvoriento." },
    okay: { "en-US": "Comfortably clean for now.", "ko-KR": "지금은 편안하게 깨끗해요.", "ja-JP": "今は心地よくきれいです。", "zh-TW": "現在乾乾淨淨，很舒服。", "de-DE": "Im Moment angenehm sauber.", "fr-FR": "Bien propre pour le moment.", "pt-BR": "Confortavelmente limpo por enquanto.", "es-MX": "Cómodamente limpio por ahora." },
    great: { "en-US": "So fresh and clean!", "ko-KR": "보송보송하고 아주 깨끗해요!", "ja-JP": "さっぱり、ぴかぴか！", "zh-TW": "清爽又乾淨！", "de-DE": "So frisch und sauber!", "fr-FR": "Tout frais et tout propre !", "pt-BR": "Tão fresco e limpinho!", "es-MX": "¡Tan fresco y limpio!" }
  }
};

export interface HudMeterGuidePresentation {
  title: string;
  description: string;
  howTo: string;
  /** Care-tray icons (same art as the matching bottom care buttons) this meter's guidance points at -- 1 for a single-action meter (fullness/thirst/cleanliness), 2 for a two-action one (mood/energy). */
  actionIcons: HomeCareActionFeedbackIcon[];
  statusLine: string;
  accessibilityLabel: string;
}

/**
 * Action-guidance-first copy for the HUD gauge guide popup — never shows raw
 * numbers. Redesigned from a status-first, streak-summary-attached popup
 * (the streak now lives only on the friend page, see
 * getFriendStreakPresentation) to lead with "what fixes this" (howTo) plus
 * the matching care-button icon, then the current status line, so tapping a
 * meter always answers "what do I do" before "how is it doing."
 */
export const getHudMeterGuidePresentation = (key: HudMeterKey, value: number, locale: AppLocale = "en-US"): HudMeterGuidePresentation => {
  const copy = hudMeterGuideCopy[key];
  const band = getCareStatBand(value);
  const title = getLocalizedText(locale, copy.title);
  const description = getLocalizedText(locale, copy.description);
  const howTo = getLocalizedText(locale, copy.howTo);
  const statusLine = getLocalizedText(locale, hudMeterStatusLineByBand[key][band]);

  return {
    title,
    description,
    howTo,
    actionIcons: hudMeterActionIconsByKey[key],
    statusLine,
    accessibilityLabel: `${title}. ${howTo} ${statusLine}`
  };
};
