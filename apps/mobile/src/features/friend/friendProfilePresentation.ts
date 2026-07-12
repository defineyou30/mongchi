import type {
  CareStats,
  CompanionHabitHint,
  ExpressionPack,
  GeneratedAsset,
  GeneratedAssetId,
  Item,
  MemoryEntry,
  MemoryType,
  RelationshipState,
  WalkCollectionState
} from "@mongchi/shared";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";
import type { AppLocale } from "../../localization/localeNormalization";
import { getResourcesForLocale } from "../../localization/resourceCatalog";
import { getLocalizedCatalogItemCopy } from "../shop/shopCatalogPresentation";
import {
  buildMonthlyLetter,
  expressionPacks,
  getBondLevelFromXp,
  getBondProgressValue,
  getFavoriteTreatItemId,
  getRecentPetMemories,
  getWalkCollectionProgress,
  MONTHLY_LETTER_THRESHOLD_DAYS,
  walkCollectibles
} from "@mongchi/shared";

/**
 * Bond progress toward the next level is currently expressed 0-99 (see
 * relationship.ts's BOND_XP_PER_LEVEL = 100, kept private to that module) --
 * this mirrors that constant only for display math so the friend page never
 * shows a raw XP number, only a bar fraction + "Lv N".
 */
const BOND_PROGRESS_MAX = 100;

const interpolateLocalizedText = (text: string, values: Readonly<Record<string, string | number>>): string =>
  Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)), text);

export interface FriendBondPresentation {
  level: number;
  progressFraction: number;
  levelLabel: string;
}

export const getFriendBondPresentation = (relationship: RelationshipState): FriendBondPresentation => {
  const level = getBondLevelFromXp(relationship.bondXp);
  const progressFraction = Math.max(0, Math.min(1, getBondProgressValue(relationship) / BOND_PROGRESS_MAX));

  return {
    level,
    progressFraction,
    levelLabel: `Lv ${level}`
  };
};

export interface FriendStreakPresentation {
  current: number;
  best: number;
  headline: string;
  subline: string;
}

const streakCopy = {
  emptyHeadline: {
    "en-US": "Say hi today to start a new streak",
    "ko-KR": "오늘 인사하며 새로운 연속 돌봄을 시작해요",
    "ja-JP": "今日声をかけて、新しい連続記録を始めよう",
    "zh-TW": "今天打個招呼，開始新的連續紀錄",
    "de-DE": "Sag heute Hallo und starte eine neue Serie",
    "fr-FR": "Dis bonjour aujourd’hui pour commencer une nouvelle série",
    "pt-BR": "Dê um oi hoje para começar uma nova sequência",
    "es-MX": "Saluda hoy para comenzar una nueva racha"
  },
  noBestSubline: {
    "en-US": "Every streak starts with one hello.",
    "ko-KR": "모든 연속 돌봄은 한 번의 인사에서 시작해요.",
    "ja-JP": "どんな連続記録も、ひとつの「こんにちは」から。",
    "zh-TW": "每段連續紀錄，都從一聲招呼開始。",
    "de-DE": "Jede Serie beginnt mit einem Hallo.",
    "fr-FR": "Chaque série commence par un petit bonjour.",
    "pt-BR": "Toda sequência começa com um oi.",
    "es-MX": "Cada racha comienza con un hola."
  },
  bestSubline: {
    "en-US": "Best so far: {{count}} day{{plural}}",
    "ko-KR": "최고 기록: {{count}}일",
    "ja-JP": "これまでの最長：{{count}}日",
    "zh-TW": "目前最佳：{{count}} 天",
    "de-DE": "Bisher am längsten: {{count}} {{day}}",
    "fr-FR": "Meilleure série : {{count}} {{day}}",
    "pt-BR": "Melhor até agora: {{count}} {{day}}",
    "es-MX": "Mejor hasta ahora: {{count}} {{day}}"
  },
  currentHeadline: {
    "en-US": "You've said hi {{count}} day{{plural}} in a row",
    "ko-KR": "{{count}}일 연속으로 인사했어요",
    "ja-JP": "{{count}}日連続で声をかけました",
    "zh-TW": "已經連續 {{count}} 天打招呼了",
    "de-DE": "Seit {{count}} Tagen begrüßt ihr euch jeden Tag",
    "fr-FR": "Vous vous dites bonjour depuis {{count}} jours d’affilée",
    "pt-BR": "Vocês se cumprimentam há {{count}} dias seguidos",
    "es-MX": "Se han saludado durante {{count}} días seguidos"
  },
  currentBestSubline: {
    "en-US": "Best streak: {{count}} day{{plural}}",
    "ko-KR": "최고 연속 돌봄: {{count}}일",
    "ja-JP": "最長記録：{{count}}日",
    "zh-TW": "最佳連續紀錄：{{count}} 天",
    "de-DE": "Längste Serie: {{count}} {{day}}",
    "fr-FR": "Meilleure série : {{count}} {{day}}",
    "pt-BR": "Melhor sequência: {{count}} {{day}}",
    "es-MX": "Mejor racha: {{count}} {{day}}"
  }
} as const satisfies Record<string, LocalizedText>;

const getLocalizedDayWord = (locale: AppLocale, count: number): string => {
  const dayWords: LocalizedText = {
    "en-US": count === 1 ? "day" : "days",
    "ko-KR": "일",
    "ja-JP": "日",
    "zh-TW": "天",
    "de-DE": count === 1 ? "Tag" : "Tage",
    "fr-FR": count === 1 ? "jour" : "jours",
    "pt-BR": count === 1 ? "dia" : "dias",
    "es-MX": count === 1 ? "día" : "días"
  };

  return getLocalizedText(locale, dayWords);
};

/** Warm, non-guilt-tripping streak copy -- silence (0) reads as an invite, not a scold. */
export const getFriendStreakPresentation = (current: number, best: number, locale: AppLocale = "en-US"): FriendStreakPresentation => {
  if (current <= 0) {
    return {
      current,
      best,
      headline: getLocalizedText(locale, streakCopy.emptyHeadline),
      subline: best > 0
        ? interpolateLocalizedText(getLocalizedText(locale, streakCopy.bestSubline), {
            count: best,
            day: getLocalizedDayWord(locale, best),
            plural: best === 1 ? "" : "s"
          })
        : getLocalizedText(locale, streakCopy.noBestSubline)
    };
  }

  return {
    current,
    best,
    headline: interpolateLocalizedText(getLocalizedText(locale, streakCopy.currentHeadline), {
      count: current,
      plural: current === 1 ? "" : "s"
    }),
    subline: interpolateLocalizedText(getLocalizedText(locale, streakCopy.currentBestSubline), {
      count: best,
      day: getLocalizedDayWord(locale, best),
      plural: best === 1 ? "" : "s"
    })
  };
};

export interface FriendWalkFindCell {
  id: string;
  found: boolean;
  emoji: string;
  name: string;
  count: number;
}

export interface FriendWalkCollectionPresentation {
  cells: FriendWalkFindCell[];
  found: number;
  total: number;
  progressLabel: string;
}

const walkFindNameById: Readonly<Record<string, LocalizedText>> = {
  col_sunny_petal: { "en-US": "Sunny Petal", "ko-KR": "햇살 꽃잎", "ja-JP": "ひだまりの花びら", "zh-TW": "陽光花瓣", "de-DE": "Sonniges Blütenblatt", "fr-FR": "Pétale ensoleillé", "pt-BR": "Pétala ensolarada", "es-MX": "Pétalo soleado" },
  col_smooth_pebble: { "en-US": "Smooth Pebble", "ko-KR": "동글 조약돌", "ja-JP": "なめらかな小石", "zh-TW": "圓滑小石", "de-DE": "Glatter Kiesel", "fr-FR": "Galet lisse", "pt-BR": "Pedrinha lisa", "es-MX": "Guijarro liso" },
  col_rain_bead: { "en-US": "Rain Bead", "ko-KR": "빗방울 구슬", "ja-JP": "雨のしずく玉", "zh-TW": "雨滴珠", "de-DE": "Regentropfenperle", "fr-FR": "Perle de pluie", "pt-BR": "Conta de chuva", "es-MX": "Perla de lluvia" },
  col_shiny_leaf: { "en-US": "Shiny Leaf", "ko-KR": "반짝 잎사귀", "ja-JP": "きらきらの葉っぱ", "zh-TW": "閃亮葉片", "de-DE": "Glänzendes Blatt", "fr-FR": "Feuille brillante", "pt-BR": "Folha brilhante", "es-MX": "Hoja brillante" },
  col_frost_sparkle: { "en-US": "Frost Sparkle", "ko-KR": "서리 조각", "ja-JP": "霜のきらめき", "zh-TW": "霜晶", "de-DE": "Frostfunkeln", "fr-FR": "Éclat de givre", "pt-BR": "Brilho de geada", "es-MX": "Destello de escarcha" },
  col_wind_ribbon: { "en-US": "Wind Ribbon", "ko-KR": "바람 리본", "ja-JP": "風のリボン", "zh-TW": "風之編帶", "de-DE": "Windband", "fr-FR": "Ruban du vent", "pt-BR": "Fita do vento", "es-MX": "Listón del viento" },
  col_warm_seed: { "en-US": "Warm Seed", "ko-KR": "햇볕 씨앗", "ja-JP": "ぬくもりの種", "zh-TW": "暖陽種子", "de-DE": "Warmer Samen", "fr-FR": "Graine chaude", "pt-BR": "Semente quentinha", "es-MX": "Semilla cálida" },
  col_mist_feather: { "en-US": "Mist Feather", "ko-KR": "안개 깃털", "ja-JP": "霧の羽根", "zh-TW": "霧羽", "de-DE": "Nebelfeder", "fr-FR": "Plume de brume", "pt-BR": "Pena de névoa", "es-MX": "Pluma de niebla" },
  col_rainbow_shard: { "en-US": "Rainbow Shard", "ko-KR": "무지개 조각", "ja-JP": "虹のかけら", "zh-TW": "彩虹碎片", "de-DE": "Regenbogensplitter", "fr-FR": "Éclat d’arc-en-ciel", "pt-BR": "Fragmento de arco-íris", "es-MX": "Fragmento de arcoíris" }
};

const walkProgressCopy: LocalizedText = {
  "en-US": "{{found}} of {{total}} found",
  "ko-KR": "{{total}}개 중 {{found}}개 발견",
  "ja-JP": "{{total}}個中{{found}}個発見",
  "zh-TW": "已找到 {{found}} / {{total}} 個",
  "de-DE": "{{found}} von {{total}} gefunden",
  "fr-FR": "{{found}} sur {{total}} trouvés",
  "pt-BR": "{{found}} de {{total}} encontrados",
  "es-MX": "{{found}} de {{total}} encontrados"
};

export const getFriendWalkCollectionPresentation = (collection: WalkCollectionState, locale: AppLocale = "en-US"): FriendWalkCollectionPresentation => {
  const progress = getWalkCollectionProgress(collection);
  const cells = walkCollectibles.map((collectible) => {
    const entry = collection[collectible.id];
    const found = (entry?.count ?? 0) > 0;

    return {
      id: collectible.id,
      found,
      emoji: found ? collectible.emoji : "?",
      name: found ? getLocalizedText(locale, walkFindNameById[collectible.id] ?? {
        "en-US": collectible.nameEn,
        "ko-KR": collectible.nameKo,
        "ja-JP": "???",
        "zh-TW": "???",
        "de-DE": "???",
        "fr-FR": "???",
        "pt-BR": "???",
        "es-MX": "???"
      }) : "???",
      count: entry?.count ?? 0
    };
  });

  return {
    cells,
    found: progress.found,
    total: progress.total,
    progressLabel: interpolateLocalizedText(getLocalizedText(locale, walkProgressCopy), progress)
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days elapsed between `sinceIso` (the pet's profile createdAt -- the
 * "moved in" moment) and `nowIso`, floored and never negative so a
 * clock-skewed or same-day read still shows "Moved in today" instead of a
 * negative number.
 */
export const getDaysTogether = (sinceIso: string, nowIso: string): number => {
  const since = new Date(sinceIso).getTime();
  const now = new Date(nowIso).getTime();

  if (!Number.isFinite(since) || !Number.isFinite(now)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - since) / DAY_MS));
};

export const getMovedInLine = (daysTogether: number, locale: AppLocale = "en-US"): string => {
  const movedInCopy = getResourcesForLocale(locale).friend.movedIn;

  if (daysTogether <= 0) {
    return movedInCopy.today;
  }

  if (locale === "en-US" && daysTogether === 1) {
    return "Moved in 1 day ago";
  }

  return interpolateLocalizedText(movedInCopy.daysAgo, { count: daysTogether });
};

// --- Our little moments (memory album) --------------------------------

/** Max timeline rows rendered before the "and more moments together..." footline kicks in. */
export const MEMORY_TIMELINE_DISPLAY_LIMIT = 8;

/**
 * Small pixel-glyph badge per memory type -- deliberately plain unicode
 * (never emoji) so the album reads as part of the same pixel-UI language as
 * the rest of the friend page rather than borrowing platform emoji art.
 */
const memoryGlyphByType: Record<MemoryType, string> = {
  moved_in: "✦", // ✦
  first_walk: "▲", // ▲
  first_find: "◆", // ◆
  rare_find: "★", // ★
  collection_complete: "❈", // ❈
  bond_level: "♥", // ♥
  streak_milestone: "●", // ●
  days_milestone: "■", // ■
  first_treat: "✦", // ✦
  theme_applied: "❖", // ❖
  expression_pack: "☺" // ☺
};

export const getMemoryGlyph = (type: MemoryType): string => memoryGlyphByType[type];

const relativeDayCopy = {
  justNow: { "en-US": "Just now", "ko-KR": "방금", "ja-JP": "たった今", "zh-TW": "剛剛", "de-DE": "Gerade eben", "fr-FR": "À l’instant", "pt-BR": "Agora mesmo", "es-MX": "Justo ahora" },
  today: { "en-US": "Today", "ko-KR": "오늘", "ja-JP": "今日", "zh-TW": "今天", "de-DE": "Heute", "fr-FR": "Aujourd’hui", "pt-BR": "Hoje", "es-MX": "Hoy" },
  yesterday: { "en-US": "Yesterday", "ko-KR": "어제", "ja-JP": "昨日", "zh-TW": "昨天", "de-DE": "Gestern", "fr-FR": "Hier", "pt-BR": "Ontem", "es-MX": "Ayer" },
  daysAgo: { "en-US": "{{count}} days ago", "ko-KR": "{{count}}일 전", "ja-JP": "{{count}}日前", "zh-TW": "{{count}} 天前", "de-DE": "Vor {{count}} Tagen", "fr-FR": "Il y a {{count}} jours", "pt-BR": "Há {{count}} dias", "es-MX": "Hace {{count}} días" }
} as const satisfies Record<string, LocalizedText>;

/**
 * Relative day label for a memory timeline row -- "Today"/"Yesterday" read
 * warmer than a raw date, "N days ago" covers everything else. Pure function
 * of two ISO timestamps so it's trivially testable without faking the clock.
 */
export const getRelativeDayLabel = (occurredAtIso: string, nowIso: string, locale: AppLocale = "en-US"): string => {
  const occurredMs = new Date(occurredAtIso).getTime();
  const nowMs = new Date(nowIso).getTime();

  if (!Number.isFinite(occurredMs) || !Number.isFinite(nowMs)) {
    return getLocalizedText(locale, relativeDayCopy.justNow);
  }

  const occurredDay = Math.floor(occurredMs / DAY_MS);
  const nowDay = Math.floor(nowMs / DAY_MS);
  const daysAgo = Math.max(0, nowDay - occurredDay);

  if (daysAgo === 0) {
    return getLocalizedText(locale, relativeDayCopy.today);
  }

  if (daysAgo === 1) {
    return getLocalizedText(locale, relativeDayCopy.yesterday);
  }

  return interpolateLocalizedText(getLocalizedText(locale, relativeDayCopy.daysAgo), { count: daysAgo });
};

export interface MemoryTimelineRow {
  id: string;
  type: MemoryType;
  glyph: string;
  line: string;
  dayLabel: string;
}

export interface FriendMemoryAlbumPresentation {
  rows: MemoryTimelineRow[];
  hasMore: boolean;
  /** True when there's only the single "moved_in" row (or nothing at all) -- the album would otherwise look bare. */
  isSparse: boolean;
  sparseLine: string;
}

const memoryAlbumSparseLine: LocalizedText = {
  "en-US": "More moments will find their way here.",
  "ko-KR": "더 많은 순간이 이곳을 찾아올 거예요.",
  "ja-JP": "ここにもっとたくさんの思い出が集まってきます。",
  "zh-TW": "更多小時光會慢慢來到這裡。",
  "de-DE": "Hier werden noch viele gemeinsame Momente einziehen.",
  "fr-FR": "D’autres jolis moments viendront se poser ici.",
  "pt-BR": "Mais momentos vão encontrar um cantinho aqui.",
  "es-MX": "Más momentos encontrarán su lugar aquí."
};

const memoryAlbumFootline: LocalizedText = {
  "en-US": "...and more moments together",
  "ko-KR": "... 그리고 더 많은 함께한 순간",
  "ja-JP": "…そして、これからもっと一緒の時間",
  "zh-TW": "…還有更多相伴的小時光",
  "de-DE": "...und noch mehr gemeinsame Momente",
  "fr-FR": "...et encore plus de moments ensemble",
  "pt-BR": "...e muitos outros momentos juntinhos",
  "es-MX": "...y muchos más momentos juntos"
};

const memoryLineByType: Record<MemoryType, LocalizedText> = {
  moved_in: { "en-US": "The day our tiny friend moved into the garden.", "ko-KR": "작은 정원에 처음 입주한 날이에요.", "ja-JP": "小さなお庭に初めてやってきた日です。", "zh-TW": "第一次搬進小花園的那一天。", "de-DE": "Der Tag, an dem unser kleiner Freund in den Garten einzog.", "fr-FR": "Le jour où notre petit ami s’est installé dans le jardin.", "pt-BR": "O dia em que nosso amiguinho chegou ao jardim.", "es-MX": "El día en que nuestro pequeño amigo llegó al jardín." },
  first_walk: { "en-US": "Our first walk together.", "ko-KR": "처음 함께 산책한 날이에요.", "ja-JP": "初めて一緒にお散歩した日です。", "zh-TW": "第一次一起去散步的那一天。", "de-DE": "Unser erster gemeinsamer Spaziergang.", "fr-FR": "Notre toute première balade ensemble.", "pt-BR": "Nosso primeiro passeio juntos.", "es-MX": "Nuestro primer paseo juntos." },
  first_find: { "en-US": "The first treasure found on a walk.", "ko-KR": "산책에서 첫 발견물을 가져왔어요.", "ja-JP": "お散歩で初めての宝物を見つけました。", "zh-TW": "散步時帶回了第一個發現。", "de-DE": "Der erste Schatz von einem Spaziergang.", "fr-FR": "Le premier trésor trouvé en balade.", "pt-BR": "O primeiro tesouro encontrado no passeio.", "es-MX": "El primer tesoro encontrado en un paseo." },
  rare_find: { "en-US": "A very special walk treasure appeared.", "ko-KR": "산책에서 아주 특별한 발견물을 찾았어요.", "ja-JP": "お散歩でとっても特別な宝物を見つけました。", "zh-TW": "散步時找到了一個特別的寶物。", "de-DE": "Ein ganz besonderer Spaziergangsschatz.", "fr-FR": "Un trésor de balade vraiment spécial.", "pt-BR": "Um tesouro muito especial apareceu no passeio.", "es-MX": "Apareció un tesoro de paseo muy especial." },
  collection_complete: { "en-US": "Our walk-find book is complete.", "ko-KR": "우리의 산책 발견물 책을 모두 채웠어요.", "ja-JP": "お散歩の発見ブックが全部埋まりました。", "zh-TW": "我們的散步發現圖鑑收集完成了。", "de-DE": "Unser Spaziergangsfundbuch ist vollständig.", "fr-FR": "Notre carnet de trouvailles est complet.", "pt-BR": "Nosso livro de achados do passeio ficou completo.", "es-MX": "Nuestro libro de hallazgos del paseo está completo." },
  bond_level: { "en-US": "Our bond grew a little closer.", "ko-KR": "우리 사이가 한층 더 가까워졌어요.", "ja-JP": "私たちの絆がもう一歩深まりました。", "zh-TW": "我們之間的感情又更深了一點。", "de-DE": "Unsere Freundschaft wurde noch ein bisschen enger.", "fr-FR": "Notre lien est devenu encore un peu plus fort.", "pt-BR": "Nosso laço ficou ainda mais pertinho.", "es-MX": "Nuestro vínculo se hizo un poquito más fuerte." },
  streak_milestone: { "en-US": "Daily hellos became a cozy little habit.", "ko-KR": "매일의 인사가 포근한 습관이 됐어요.", "ja-JP": "毎日のあいさつが、心地よい習慣になりました。", "zh-TW": "每天的招呼變成了溫暖的小習慣。", "de-DE": "Tägliche Hallos wurden zu einer gemütlichen Gewohnheit.", "fr-FR": "Les petits bonjours quotidiens sont devenus une douce habitude.", "pt-BR": "Os oizinhos de todo dia viraram um hábito gostoso.", "es-MX": "Los saludos diarios se volvieron una costumbre acogedora." },
  days_milestone: { "en-US": "Our time together reached another little milestone.", "ko-KR": "함께한 시간이 또 하나의 기념일이 됐어요.", "ja-JP": "一緒の時間が、またひとつの記念日になりました。", "zh-TW": "相伴的時光又迎來了一個小里程碑。", "de-DE": "Unsere gemeinsame Zeit erreichte einen neuen kleinen Meilenstein.", "fr-FR": "Notre temps ensemble a franchi une nouvelle petite étape.", "pt-BR": "Nosso tempo juntos ganhou mais um pequeno marco.", "es-MX": "Nuestro tiempo juntos alcanzó otro pequeño logro." },
  first_treat: { "en-US": "Our first tasty treat together.", "ko-KR": "처음으로 맛있는 간식을 함께했어요.", "ja-JP": "初めて一緒においしいおやつを楽しみました。", "zh-TW": "第一次一起享用了美味點心。", "de-DE": "Unser erstes leckeres Leckerli zusammen.", "fr-FR": "Notre première friandise savourée ensemble.", "pt-BR": "Nosso primeiro petisco gostoso juntos.", "es-MX": "Nuestro primer premio delicioso juntos." },
  theme_applied: { "en-US": "The garden became cozy in a new way.", "ko-KR": "정원이 새로운 모습으로 포근해졌어요.", "ja-JP": "お庭が新しい表情でほっこりしました。", "zh-TW": "花園換上了新樣貌，一樣溫暖。", "de-DE": "Der Garten wurde auf eine neue Art gemütlich.", "fr-FR": "Le jardin est devenu douillet d’une nouvelle façon.", "pt-BR": "O jardim ficou aconchegante de um jeito novo.", "es-MX": "El jardín se volvió acogedor de una forma nueva." },
  expression_pack: { "en-US": "We discovered some new expressions together.", "ko-KR": "새로운 표정을 함께 만나기 시작했어요.", "ja-JP": "新しい表情に一緒に出会いました。", "zh-TW": "我們一起發現了新表情。", "de-DE": "Wir haben zusammen neue Ausdrücke entdeckt.", "fr-FR": "Nous avons découvert de nouvelles expressions ensemble.", "pt-BR": "Descobrimos novas expressões juntos.", "es-MX": "Descubrimos nuevas expresiones juntos." }
};

/**
 * Newest-first timeline for the "Our little moments" card, capped at
 * MEMORY_TIMELINE_DISPLAY_LIMIT rows. A brand-new owner only has the
 * "moved_in" entry -- that still renders as one real row (never a blank
 * card), plus a forward-looking "more moments will find their way here"
 * line so the card doesn't read as empty/broken.
 */
export const getFriendMemoryAlbumPresentation = (memories: MemoryEntry[], nowIso: string, locale: AppLocale = "en-US"): FriendMemoryAlbumPresentation => {
  const recent = getRecentPetMemories(memories, MEMORY_TIMELINE_DISPLAY_LIMIT);
  const rows = recent.map((memory) => ({
    id: memory.id,
    type: memory.type,
    glyph: getMemoryGlyph(memory.type),
    line: locale === "en-US" ? memory.line : getLocalizedText(locale, memoryLineByType[memory.type]),
    dayLabel: getRelativeDayLabel(memory.occurredAt, nowIso, locale)
  }));

  return {
    rows,
    hasMore: memories.length > MEMORY_TIMELINE_DISPLAY_LIMIT,
    isSparse: rows.length <= 1,
    sparseLine: getLocalizedText(locale, memoryAlbumSparseLine)
  };
};

export const MEMORY_ALBUM_FOOTLINE = getLocalizedText("en-US", memoryAlbumFootline);
export const getMemoryAlbumFootline = (locale: AppLocale = "en-US"): string => getLocalizedText(locale, memoryAlbumFootline);

// --- Lately, {name}... (companion habit summary) -----------------------

/** One warm, present-tense line per habit hint -- never guilt-tripping, always reads as an observation. */
const habitHintLineByHint: Record<CompanionHabitHint, LocalizedText> = {
  loves_playtime: { "en-US": "has been all about playtime lately", "ko-KR": "요즘 놀이 시간만 기다리고 있어요", "ja-JP": "最近は遊ぶ時間が大好きです", "zh-TW": "最近滿心期待著玩耍時間", "de-DE": "dreht sich in letzter Zeit ganz ums Spielen", "fr-FR": "ne pense qu’à jouer ces derniers temps", "pt-BR": "anda adorando a hora de brincar", "es-MX": "no deja de pensar en la hora de jugar" },
  cuddle_bug: { "en-US": "has been extra snuggly lately", "ko-KR": "요즘 유난히 포근하게 안기고 싶어 해요", "ja-JP": "最近はいつもよりあまえんぼうです", "zh-TW": "最近特別喜歡溫暖的抱抱", "de-DE": "kuschelt in letzter Zeit besonders gern", "fr-FR": "est encore plus câlin ces derniers temps", "pt-BR": "anda ainda mais dengoso ultimamente", "es-MX": "ha estado especialmente cariñoso últimamente" },
  trail_buddy: { "en-US": "loves a good walk together", "ko-KR": "함께 걷는 산책을 좋아해요", "ja-JP": "一緒に歩くお散歩が大好きです", "zh-TW": "喜歡一起好好散個步", "de-DE": "liebt einen schönen Spaziergang zusammen", "fr-FR": "adore les jolies balades ensemble", "pt-BR": "adora um bom passeio juntinho", "es-MX": "adora dar un buen paseo contigo" },
  foodie: { "en-US": "never says no to a snack", "ko-KR": "맛있는 간식이라면 언제나 좋아해요", "ja-JP": "おいしいおやつならいつでも大歓迎です", "zh-TW": "從來不會對點心說不", "de-DE": "sagt zu einem Leckerli nie Nein", "fr-FR": "ne dit jamais non à une friandise", "pt-BR": "nunca recusa um petisco", "es-MX": "nunca le dice que no a un premio" },
  chatterbox: { "en-US": "has so much to chat about lately", "ko-KR": "요즘 나누고 싶은 이야기가 많아요", "ja-JP": "最近はおしゃべりしたいことがたくさんあります", "zh-TW": "最近有好多話想說", "de-DE": "hat in letzter Zeit so viel zu erzählen", "fr-FR": "a tant de choses à raconter ces derniers temps", "pt-BR": "anda com muita coisa para conversar", "es-MX": "tiene muchísimo que contar últimamente" },
  gentle_groomer: { "en-US": "always enjoys a good grooming session", "ko-KR": "보송하게 돌봄받는 시간을 좋아해요", "ja-JP": "きれいにしてもらう時間が大好きです", "zh-TW": "喜歡被好好整理得蓬鬆乾淨", "de-DE": "genießt eine sanfte Pflegerunde", "fr-FR": "aime toujours une douce séance de soin", "pt-BR": "sempre curte um cuidado bem gostoso", "es-MX": "siempre disfruta una buena sesión de cuidado" },
  green_thumb: { "en-US": "loves tending the garden", "ko-KR": "정원을 돌보는 시간을 좋아해요", "ja-JP": "お庭のお世話が大好きです", "zh-TW": "喜歡照顧花園的時光", "de-DE": "kümmert sich liebend gern um den Garten", "fr-FR": "adore prendre soin du jardin", "pt-BR": "adora cuidar do jardim", "es-MX": "adora cuidar el jardín" },
  night_owl_rester: { "en-US": "has been savoring cozy rest lately", "ko-KR": "요즘 포근한 휴식을 느긋하게 즐겨요", "ja-JP": "最近はほっこりしたお休み時間を楽しんでいます", "zh-TW": "最近慢慢享受著舒服的休息", "de-DE": "genießt in letzter Zeit gemütliche Ruhe", "fr-FR": "savoure de doux moments de repos", "pt-BR": "anda saboreando um descanso bem aconchegante", "es-MX": "ha estado disfrutando de un descanso acogedor" }
};

const settlingInLine: LocalizedText = { "en-US": "is still settling in and finding favorite things.", "ko-KR": "아직 새 집에 적응하며 좋아하는 것을 찾고 있어요.", "ja-JP": "まだ新しいおうちに慣れながら、好きなものを探しています。", "zh-TW": "還在慢慢適應新家，找尋喜歡的事物。", "de-DE": "gewöhnt sich noch ein und entdeckt Lieblingsdinge.", "fr-FR": "prend encore ses marques et découvre ses petits préférés.", "pt-BR": "ainda est se acostumando e descobrindo suas coisas favoritas.", "es-MX": "todavía se está acomodando y descubriendo sus cosas favoritas." };

const favoriteThingLine: LocalizedText = { "en-US": "Always up for {{favorite}}", "ko-KR": "{{favorite}}이라면 언제나 좋아해요", "ja-JP": "{{favorite}}ならいつでも大歓迎です", "zh-TW": "隨時都想要{{favorite}}", "de-DE": "Immer zu haben für {{favorite}}", "fr-FR": "Toujours partant pour {{favorite}}", "pt-BR": "Sempre anima com {{favorite}}", "es-MX": "Siempre se anima con {{favorite}}" };
const favoriteTreatLine: LocalizedText = { "en-US": "Current favorite: {{treat}}", "ko-KR": "요즘 가장 좋아하는 간식: {{treat}}", "ja-JP": "今のお気に入りおやつ：{{treat}}", "zh-TW": "最近最喜歡的點心：{{treat}}", "de-DE": "Aktuelles Lieblingsleckerli: {{treat}}", "fr-FR": "Friandise préférée du moment : {{treat}}", "pt-BR": "Petisco favorito agora: {{treat}}", "es-MX": "Premio favorito del momento: {{treat}}" };

/**
 * Habit line(s) for the "Lately, {name}..." card. Up to two hints are shown
 * (a favorite-action hint plus the volume-based trail_buddy hint can both
 * apply at once) -- with no hints yet (brand-new companion), a single
 * forward-looking "still settling in" line is shown instead.
 */
export const getCompanionHabitLines = (hints: CompanionHabitHint[], locale: AppLocale = "en-US"): string[] => {
  if (hints.length === 0) {
    return [getLocalizedText(locale, settlingInLine)];
  }

  return hints.slice(0, 2).map((hint) => getLocalizedText(locale, habitHintLineByHint[hint]));
};

export interface FriendHabitSummaryPresentation {
  habitLines: string[];
  favoriteThingLine: string | null;
  favoriteTreatLine: string | null;
}

/**
 * Assembles the full "Lately, {name}..." card content: the habit line(s),
 * an optional "Always up for {favoriteThing}" line carried over from
 * onboarding, and an optional "Current favorite: {treat name}" line resolved
 * from the catalog. Any of the optional lines can be null (new owner with no
 * signal yet) -- callers render only what's present.
 */
export const getFriendHabitSummaryPresentation = (
  hints: CompanionHabitHint[],
  favoriteThing: string | undefined,
  favoriteTreatItemId: string | null,
  catalogItems: Item[],
  locale: AppLocale = "en-US"
): FriendHabitSummaryPresentation => {
  const trimmedFavoriteThing = favoriteThing?.trim();
  const favoriteTreatItem = favoriteTreatItemId ? catalogItems.find((item) => item.id === favoriteTreatItemId) ?? null : null;

  return {
    habitLines: getCompanionHabitLines(hints, locale),
    favoriteThingLine: trimmedFavoriteThing
      ? interpolateLocalizedText(getLocalizedText(locale, favoriteThingLine), { favorite: trimmedFavoriteThing })
      : null,
    favoriteTreatLine: favoriteTreatItem
      ? interpolateLocalizedText(getLocalizedText(locale, favoriteTreatLine), {
          treat: getLocalizedCatalogItemCopy(favoriteTreatItem, locale).name
        })
      : null
  };
};

// --- Monthly letter (30-day milestone) ----------------------------------

export type FriendMonthlyLetterStatus = "locked" | "arrived" | "opened";

export interface FriendMonthlyLetterPresentation {
  status: FriendMonthlyLetterStatus;
  /** Full letter text -- only present once daysTogether has reached the threshold. */
  letterText: string | null;
  /** Locked-preview copy shown before day 30 ("Day {n} of 30" progress read, no countdown framing). */
  previewLine: string;
  progressLabel: string;
}

const monthlyLetterLockedPreviewLine: LocalizedText = { "en-US": "A letter is on its way -- arriving on day 30.", "ko-KR": "30일째에 도착할 편지가 천천히 오고 있어요.", "ja-JP": "30日目に届くお手紙が、ゆっくり向かっています。", "zh-TW": "一封信正慢慢前來，會在第 30 天抵達。", "de-DE": "Ein Brief ist unterwegs und kommt am 30. Tag an.", "fr-FR": "Une lettre est en chemin et arrivera au 30e jour.", "pt-BR": "Uma cartinha está a caminho e chega no 30º dia.", "es-MX": "Una carta viene en camino y llegará el día 30." };
const monthlyLetterArrivedLine: LocalizedText = { "en-US": "A letter has arrived. Open it whenever you're ready.", "ko-KR": "편지가 도착했어요. 마음이 내킬 때 열어보세요.", "ja-JP": "お手紙が届きました。開きたいときにどうぞ。", "zh-TW": "信已經到了。想打開的時候再慢慢看。", "de-DE": "Ein Brief ist angekommen. Öffne ihn, wann immer du bereit bist.", "fr-FR": "Une lettre est arrivée. Ouvre-la quand tu en auras envie.", "pt-BR": "Uma cartinha chegou. Abra quando sentir vontade.", "es-MX": "Llegó una carta. Ábrela cuando tengas ganas." };
const monthlyLetterProgressLine: LocalizedText = { "en-US": "Day {{current}} of {{total}}", "ko-KR": "{{total}}일 중 {{current}}일", "ja-JP": "{{current}}日目 / {{total}}日", "zh-TW": "第 {{current}} 天，共 {{total}} 天", "de-DE": "Tag {{current}} von {{total}}", "fr-FR": "Jour {{current}} sur {{total}}", "pt-BR": "Dia {{current}} de {{total}}", "es-MX": "Día {{current}} de {{total}}" };
const monthlyLetterBody: LocalizedText = {
  "en-US": "Our first month together turned little hellos and caring moments into cozy memories. You never had to make every day look the same. Every time you came back meant so much to {{petName}}.",
  "ko-KR": "{{petName}}와 함께한 첫 한 달 동안 작은 인사와 돌봄이 포근한 추억이 되었어요. 매일 같은 모습일 필요는 없어요. 다시 돌아와 함께해 준 모든 순간이 참 고마워요.",
  "ja-JP": "{{petName}}と過ごした最初の1か月。小さなあいさつやお世話が、あたたかい思い出になりました。毎日が同じでなくても大丈夫。また会いに来てくれたひとつひとつの時間が、とてもうれしかったです。",
  "zh-TW": "和 {{petName}} 相伴的第一個月，小小的招呼與照顧都變成了溫暖回憶。每天不用都一樣。你每一次回來相伴，都是很珍貴的時光。",
  "de-DE": "Im ersten Monat mit {{petName}} wurden kleine Hallos und liebevolle Pflege zu gemütlichen Erinnerungen. Kein Tag musste wie der andere sein. Jedes Wiederkommen hat so viel bedeutet.",
  "fr-FR": "Pendant ce premier mois avec {{petName}}, les petits bonjours et les gestes tendres sont devenus de doux souvenirs. Les journées n’avaient pas besoin de toutes se ressembler. Chaque retour a beaucoup compté.",
  "pt-BR": "No primeiro mês com {{petName}}, pequenos ois e momentos de cuidado viraram lembranças aconchegantes. Nenhum dia precisava ser igual ao outro. Cada vez que você voltou teve um carinho especial.",
  "es-MX": "Durante el primer mes con {{petName}}, los pequeños saludos y cuidados se volvieron recuerdos acogedores. Ningún día tenía que ser igual al anterior. Cada vez que regresaste significó muchísimo."
};
const monthlyLetterFavoriteThingLine: LocalizedText = { "en-US": "Your love for {{favorite}} made me smile.", "ko-KR": "{{favorite}}을 좋아하는 모습이 정말 사랑스러웠어요.", "ja-JP": "{{favorite}}が大好きな姿に、たくさん笑顔をもらいました。", "zh-TW": "喜歡{{favorite}}的樣子，總讓人微笑。", "de-DE": "Die Freude an {{favorite}} hat mich immer lächeln lassen.", "fr-FR": "Ton amour pour {{favorite}} m’a donné le sourire.", "pt-BR": "Seu carinho por {{favorite}} sempre trouxe um sorriso.", "es-MX": "Tu gusto por {{favorite}} siempre me sacó una sonrisa." };
const monthlyLetterFavoriteTreatLine: LocalizedText = { "en-US": "And {{treat}} became a favorite little treat.", "ko-KR": "그리고 {{treat}}은 어느새 좋아하는 간식이 되었어요.", "ja-JP": "そして{{treat}}は、お気に入りのおやつになりました。", "zh-TW": "而 {{treat}} 也變成了最喜歡的小點心。", "de-DE": "Und {{treat}} wurde zum kleinen Lieblingsleckerli.", "fr-FR": "Et {{treat}} est devenu la petite friandise préférée.", "pt-BR": "E {{treat}} virou o petisco favorito.", "es-MX": "Y {{treat}} se convirtió en el premio favorito." };

/**
 * Assembles the friend page's monthly-letter card. Three states:
 * - "locked": before day 30, a sealed-envelope preview with a "Day n of 30"
 *   progress read (no countdown/number-heavy framing beyond that one line).
 * - "arrived": day 30 reached but `hasOpened` is still false -- the letter
 *   text already exists (so the card can offer to open it) but isn't shown
 *   until the owner taps "Open".
 * - "opened": `hasOpened` is true -- the letter is always shown in full and
 *   stays readable on every future visit (letterText is never cleared).
 */
export const getFriendMonthlyLetterPresentation = (
  input: {
    petName: string;
    memories: readonly MemoryEntry[];
    careStats: CareStats;
    favoriteThing?: string | null | undefined;
    catalogItems: Item[];
    daysTogether: number;
    now: string;
  },
  hasOpened: boolean,
  locale: AppLocale = "en-US"
): FriendMonthlyLetterPresentation => {
  const favoriteTreatItemId = getFavoriteTreatItemId(input.careStats);
  const favoriteTreatItem = favoriteTreatItemId ? input.catalogItems.find((item) => item.id === favoriteTreatItemId) ?? null : null;

  const letterText = locale === "en-US"
    ? buildMonthlyLetter({
        petName: input.petName,
        memories: input.memories,
        careStats: input.careStats,
        favoriteThing: input.favoriteThing,
        favoriteTreatName: favoriteTreatItem?.name ?? null,
        daysTogether: input.daysTogether,
        now: input.now
      })
    : input.daysTogether >= MONTHLY_LETTER_THRESHOLD_DAYS
      ? [
          interpolateLocalizedText(getLocalizedText(locale, monthlyLetterBody), { petName: input.petName }),
          input.favoriteThing?.trim()
            ? interpolateLocalizedText(getLocalizedText(locale, monthlyLetterFavoriteThingLine), { favorite: input.favoriteThing.trim() })
            : null,
          favoriteTreatItem
            ? interpolateLocalizedText(getLocalizedText(locale, monthlyLetterFavoriteTreatLine), {
                treat: getLocalizedCatalogItemCopy(favoriteTreatItem, locale).name
              })
            : null
        ].filter((line): line is string => line !== null).join(" ")
      : null;

  const progressLabel = interpolateLocalizedText(getLocalizedText(locale, monthlyLetterProgressLine), {
    current: Math.min(input.daysTogether, MONTHLY_LETTER_THRESHOLD_DAYS),
    total: MONTHLY_LETTER_THRESHOLD_DAYS
  });

  if (!letterText) {
    return {
      status: "locked",
      letterText: null,
      previewLine: getLocalizedText(locale, monthlyLetterLockedPreviewLine),
      progressLabel
    };
  }

  return {
    status: hasOpened ? "opened" : "arrived",
    letterText,
    previewLine: getLocalizedText(locale, monthlyLetterArrivedLine),
    progressLabel
  };
};

// --- Poses gallery (expression pack sales surface) ----------------------

export type FriendPoseCellStatus = "owned" | "locked";

export interface FriendPoseCell {
  state: GeneratedAssetState;
  status: FriendPoseCellStatus;
  /** Present only for an owned pose -- id/uri to render via GeneratedPetAssetImage. */
  assetId: GeneratedAssetId | null;
}

export type FriendPoseCardStatus = "available" | "purchasing" | "failed";

export interface FriendPoseCard {
  packId: string;
  nameEn: string;
  creditCost: number;
  status: FriendPoseCardStatus;
  /** "See more of {name} -- Everyday Moments · 12cr" style label for the Unlock card. */
  label: string;
  /** Soft-progress line shown while a purchase is mid-flight (e.g. "New moments are on their way..."). */
  progressLine: string | null;
  /** Warm retry line shown after a failed purchase attempt. */
  failureLine: string | null;
}

export interface FriendPoseGalleryPresentation {
  cells: FriendPoseCell[];
  /** One card per not-yet-fully-owned pack -- absent once every state in a pack has a matching asset. */
  cards: FriendPoseCard[];
}

type GeneratedAssetState = GeneratedAsset["state"];

const expressionPackNameById: Readonly<Record<string, LocalizedText>> = {
  "pack-everyday-moments": { "en-US": "Everyday Moments", "ko-KR": "일상의 순간들", "ja-JP": "いつもの時間", "zh-TW": "日常時光", "de-DE": "Alltagsmomente", "fr-FR": "Moments du quotidien", "pt-BR": "Momentos do dia a dia", "es-MX": "Momentos cotidianos" },
  "pack-care-reactions": { "en-US": "Care Reactions", "ko-KR": "돌봄 리액션", "ja-JP": "お世話のリアクション", "zh-TW": "照顧反應", "de-DE": "Fürsorgereaktionen", "fr-FR": "Réactions aux soins", "pt-BR": "Reações de carinho", "es-MX": "Reacciones de cuidado" },
  "pack-special-days": { "en-US": "Special Days", "ko-KR": "특별한 날", "ja-JP": "特別な日", "zh-TW": "特別日子", "de-DE": "Besondere Tage", "fr-FR": "Jours spéciaux", "pt-BR": "Dias especiais", "es-MX": "Días especiales" },
  "pack-tender-care": { "en-US": "Tender Care", "ko-KR": "다정한 돌봄", "ja-JP": "やさしいお世話", "zh-TW": "溫柔照顧", "de-DE": "Zarte Fürsorge", "fr-FR": "Soins tendres", "pt-BR": "Cuidado carinhoso", "es-MX": "Cuidado cariñoso" }
};

const posePackLabel: LocalizedText = { "en-US": "See more of {{petName}} — {{packName}} · {{credits}}cr", "ko-KR": "{{petName}}의 새로운 모습 — {{packName}} · 크레딧 {{credits}}개", "ja-JP": "{{petName}}の新しい表情 — {{packName}} ・ {{credits}}クレジット", "zh-TW": "看見 {{petName}} 更多樣貌 — {{packName}} ・ {{credits}} 點數", "de-DE": "Mehr von {{petName}} entdecken — {{packName}} · {{credits}} Credits", "fr-FR": "Découvrir plus de {{petName}} — {{packName}} · {{credits}} crédits", "pt-BR": "Ver mais jeitinhos de {{petName}} — {{packName}} · {{credits}} créditos", "es-MX": "Descubre más facetas de {{petName}} — {{packName}} · {{credits}} créditos" };
const posePackProgressLine: LocalizedText = { "en-US": "New moments are on their way...", "ko-KR": "새로운 순간이 오고 있어요...", "ja-JP": "新しい表情を準備しています...", "zh-TW": "新的小時光正在路上...", "de-DE": "Neue Momente sind unterwegs...", "fr-FR": "De nouveaux moments arrivent...", "pt-BR": "Novos momentos estão a caminho...", "es-MX": "Nuevos momentos vienen en camino..." };
const posePackFailureLine: LocalizedText = { "en-US": "That didn't quite work. Let's try again.", "ko-KR": "잠시 길이 막혔어요. 다시 시도해 볼까요?", "ja-JP": "うまくいかなかったようです。もう一度試してみましょう。", "zh-TW": "這次沒有順利完成。再試一次吧。", "de-DE": "Das hat noch nicht geklappt. Versuchen wir es noch einmal.", "fr-FR": "Cela n’a pas tout à fait fonctionné. Réessayons.", "pt-BR": "Não deu certo desta vez. Vamos tentar de novo.", "es-MX": "Esta vez no salió del todo bien. Intentémoslo de nuevo." };
const expressionPackUnlockedToastLine: LocalizedText = { "en-US": "{{petName}} learned some new expressions!", "ko-KR": "{{petName}}가 새로운 표정을 배웠어요!", "ja-JP": "{{petName}}が新しい表情を覚えました！", "zh-TW": "{{petName}} 學會了新表情！", "de-DE": "{{petName}} hat neue Ausdrücke gelernt!", "fr-FR": "{{petName}} a appris de nouvelles expressions !", "pt-BR": "{{petName}} aprendeu novas expressões!", "es-MX": "¡{{petName}} aprendió nuevas expresiones!" };

/**
 * Builds the friend page's "Poses" gallery: every generated-asset state the
 * pet could ever have renders as one cell, either the real thumbnail (owned)
 * or a "?" silhouette (locked). Below the grid, one card per expression pack
 * that isn't fully unlocked yet offers the purchase -- a pack already fully
 * represented in acceptedAssets (its states all have matching cells) simply
 * has no card, since there's nothing left to sell. purchaseStatusByPackId
 * only needs entries for packs actively purchasing/failed; a pack absent
 * from it (or an id with no owned states yet) reads as "available".
 */
export const getFriendPoseGalleryPresentation = (
  acceptedAssets: readonly GeneratedAsset[],
  petName: string,
  purchaseStatusByPackId: Partial<Record<string, { status: "pending" | "failed"; failureMessageSafe?: string }>> = {},
  locale: AppLocale = "en-US"
): FriendPoseGalleryPresentation => {
  const assetByState = new Map(acceptedAssets.map((asset) => [asset.state, asset]));

  const cells: FriendPoseCell[] = Array.from(assetByState.values()).map((asset) => ({
    state: asset.state,
    status: "owned" as const,
    assetId: asset.id
  }));

  // Every pack state not already owned gets a locked silhouette cell too, so
  // the grid always previews the full breadth of expressions on offer.
  const lockedStates = new Set<GeneratedAssetState>();

  for (const pack of expressionPacks as readonly ExpressionPack[]) {
    for (const state of pack.states) {
      if (!assetByState.has(state)) {
        lockedStates.add(state);
      }
    }
  }

  for (const state of lockedStates) {
    cells.push({ state, status: "locked", assetId: null });
  }

  const cards: FriendPoseCard[] = [];

  for (const pack of expressionPacks as readonly ExpressionPack[]) {
    const alreadyUnlocked = pack.states.every((state) => assetByState.has(state));

    if (alreadyUnlocked) {
      continue;
    }

    const purchaseStatus = purchaseStatusByPackId[pack.id];
    const status: FriendPoseCardStatus =
      purchaseStatus?.status === "pending" ? "purchasing" : purchaseStatus?.status === "failed" ? "failed" : "available";
    const localizedPackName = getLocalizedText(locale, expressionPackNameById[pack.id] ?? {
      "en-US": pack.nameEn,
      "ko-KR": pack.nameKo,
      "ja-JP": getResourcesForLocale("ja-JP").shop.dialogs.posePack,
      "zh-TW": getResourcesForLocale("zh-TW").shop.dialogs.posePack,
      "de-DE": getResourcesForLocale("de-DE").shop.dialogs.posePack,
      "fr-FR": getResourcesForLocale("fr-FR").shop.dialogs.posePack,
      "pt-BR": getResourcesForLocale("pt-BR").shop.dialogs.posePack,
      "es-MX": getResourcesForLocale("es-MX").shop.dialogs.posePack
    });

    cards.push({
      packId: pack.id,
      nameEn: localizedPackName,
      creditCost: pack.creditCost,
      status,
      label: interpolateLocalizedText(getLocalizedText(locale, posePackLabel), {
        petName,
        packName: localizedPackName,
        credits: pack.creditCost
      }),
      progressLine: status === "purchasing" ? getLocalizedText(locale, posePackProgressLine) : null,
      failureLine:
        status === "failed"
          ? locale === "en-US" && purchaseStatus?.failureMessageSafe
            ? purchaseStatus.failureMessageSafe
            : getLocalizedText(locale, posePackFailureLine)
          : null
    });
  }

  return { cells, cards };
};

/** One-shot HomeEventToast line for a completed expression pack purchase. */
export const getExpressionPackUnlockedToastLine = (petName: string, locale: AppLocale = "en-US"): string =>
  interpolateLocalizedText(getLocalizedText(locale, expressionPackUnlockedToastLine), { petName });

// --- Pose gallery reveal showcase (post-unlock stagger + one-shot banner) ---

/**
 * States newly present in `currentOwnedStates` that were absent from
 * `previousOwnedStates` -- drives the friend page's stagger-reveal
 * showcase so only the cells that just unlocked play the fade+scale-in,
 * never the whole grid. Order follows `currentOwnedStates` (which itself
 * follows acceptedAssets insertion order) so the stagger reads left-to-right
 * the same way the grid renders.
 */
export const getNewlyRevealedPoseStates = (
  previousOwnedStates: readonly GeneratedAssetState[],
  currentOwnedStates: readonly GeneratedAssetState[]
): GeneratedAssetState[] => {
  const previousSet = new Set(previousOwnedStates);

  return currentOwnedStates.filter((state) => !previousSet.has(state));
};

const smallCountWordsByLocale: Record<AppLocale, readonly string[]> = {
  "en-US": ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
  "ko-KR": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "ja-JP": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "zh-TW": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  "de-DE": ["null", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"],
  "fr-FR": ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
  "pt-BR": ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"],
  "es-MX": ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"]
};

/** Spells out small counts ("Three new sides...") to match the app's existing milestone-copy voice; falls back to digits past ten. */
const spellOutCount = (count: number, locale: AppLocale): string => smallCountWordsByLocale[locale][count] ?? String(count);

/**
 * One-shot banner line shown above the poses gallery the first time a batch
 * of new expressions reveals itself -- warm and specific ("Three new sides
 * of Momo.") rather than a generic "unlocked!" toast. Callers gate actual
 * one-shot-ness via getPoseRevealPersistedKey + AsyncStorage, matching the
 * house pattern used for the monthly letter / event toast dedup keys.
 */
export const getPoseRevealBannerLine = (petName: string, revealedCount: number, locale: AppLocale = "en-US"): string | null => {
  if (revealedCount <= 0) {
    return null;
  }

  const countWord = spellOutCount(revealedCount, locale);
  const capitalizedCountWord = countWord.charAt(0).toUpperCase() + countWord.slice(1);

  switch (locale) {
    case "en-US":
      return `${capitalizedCountWord} new ${revealedCount === 1 ? "side" : "sides"} of ${petName}.`;
    case "ko-KR":
      return `${petName}의 새로운 모습 ${revealedCount}개를 만났어요.`;
    case "ja-JP":
      return `${petName}の新しい表情を${revealedCount}つ見つけました。`;
    case "zh-TW":
      return `看見了 ${petName} 的 ${revealedCount} 個新樣貌。`;
    case "de-DE":
      return revealedCount === 1 ? `Eine neue Seite von ${petName}.` : `${capitalizedCountWord} neue Seiten von ${petName}.`;
    case "fr-FR":
      return revealedCount === 1 ? `Un nouveau visage de ${petName}.` : `${capitalizedCountWord} nouveaux visages de ${petName}.`;
    case "pt-BR":
      return revealedCount === 1 ? `Um novo jeitinho de ${petName}.` : `${capitalizedCountWord} novos jeitinhos de ${petName}.`;
    case "es-MX":
      return revealedCount === 1 ? `Una nueva faceta de ${petName}.` : `${capitalizedCountWord} nuevas facetas de ${petName}.`;
  }
};

/** AsyncStorage key suffix for "has this pack's reveal showcase already played once" -- mirrors getExpressionPackToastPersistedKey's shape. */
export const getPoseRevealPersistedKey = (packId: string): string => `pose-reveal:${packId}`;
