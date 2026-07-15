import type { AppLocale } from "../../localization/localeNormalization";
import { getLocalizedText } from "../../localization/localizedText";
import type { LocalizedText } from "../../localization/localizedText";

export type HomeRetentionMilestoneId = "day1" | "day3" | "day7" | "day14" | "day30";
export type HomeRetentionPromptTone = "daily" | "reward" | "memory" | "letter";
export type HomeRetentionPromptAction = "care" | "friend";
/**
 * "full" is the normal card; "chip" is the one-line, milestone-title-only
 * summary it collapses into once today's care is done (or once the owner
 * folds it manually) -- see getHomeRetentionCardDisplayMode.
 */
export type HomeRetentionCardDisplayMode = "full" | "chip";

export interface HomeRetentionPromptPresentation {
  readonly milestoneId: HomeRetentionMilestoneId;
  readonly eyebrow: string;
  readonly title: string;
  readonly line: string;
  readonly ctaLabel: string;
  readonly action: HomeRetentionPromptAction;
  readonly progressLabel: string;
  readonly tone: HomeRetentionPromptTone;
  readonly accessibilityLabel: string;
  readonly collapseAccessibilityLabel: string;
  readonly chipAccessibilityLabel: string;
}

/**
 * What gets persisted (AsyncStorage) when the owner manually folds the card
 * with its collapse control. Scoped to both the calendar day and the
 * milestone active when they folded it, so it never survives past that day
 * (b) or into a new milestone reached mid-day (c) -- either mismatch and the
 * card is back to full on its own, no explicit "unfold" needed.
 */
export interface HomeRetentionCollapsedState {
  readonly dateKey: string;
  readonly milestoneId: HomeRetentionMilestoneId;
}

const homeRetentionMilestoneIds: readonly HomeRetentionMilestoneId[] = ["day1", "day3", "day7", "day14", "day30"];

const isHomeRetentionMilestoneId = (value: unknown): value is HomeRetentionMilestoneId =>
  typeof value === "string" && (homeRetentionMilestoneIds as readonly string[]).includes(value);

/**
 * Parses the AsyncStorage-persisted collapse marker. Defensive by design --
 * a missing key, a corrupt string, or a payload shaped by some future app
 * version should just fall back to the full card rather than throw, so this
 * returns null on anything it doesn't fully recognize.
 */
export const parseHomeRetentionCollapsedState = (raw: string | null | undefined): HomeRetentionCollapsedState | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "dateKey" in parsed &&
      "milestoneId" in parsed &&
      typeof (parsed as { dateKey: unknown }).dateKey === "string" &&
      isHomeRetentionMilestoneId((parsed as { milestoneId: unknown }).milestoneId)
    ) {
      return {
        dateKey: (parsed as { dateKey: string }).dateKey,
        milestoneId: (parsed as { milestoneId: HomeRetentionMilestoneId }).milestoneId
      };
    }

    return null;
  } catch {
    return null;
  }
};

export const serializeHomeRetentionCollapsedState = (state: HomeRetentionCollapsedState): string => JSON.stringify(state);

/**
 * Decides whether the retention prompt should render as the full card or the
 * one-line chip.
 *
 * - `isExpandedOverride` wins outright: the owner tapped the chip to peek at
 *   the full card again, and that holds until the milestone changes or they
 *   fold it again themselves.
 * - Otherwise, today's care being done (a) or a same-day-and-milestone
 *   manual fold (b) each independently collapse it to the chip.
 * - A stale `collapsedState` (wrong day, or the milestone moved on --
 *   c) is simply ignored, so a new milestone day always starts full.
 */
export const getHomeRetentionCardDisplayMode = ({
  milestoneId,
  hasCaredToday,
  todayDateKey,
  collapsedState,
  isExpandedOverride = false
}: {
  readonly milestoneId: HomeRetentionMilestoneId;
  readonly hasCaredToday: boolean;
  readonly todayDateKey: string;
  readonly collapsedState: HomeRetentionCollapsedState | null;
  readonly isExpandedOverride?: boolean;
}): HomeRetentionCardDisplayMode => {
  if (isExpandedOverride) {
    return "full";
  }

  const isManuallyCollapsedToday =
    collapsedState !== null && collapsedState.dateKey === todayDateKey && collapsedState.milestoneId === milestoneId;

  return hasCaredToday || isManuallyCollapsedToday ? "chip" : "full";
};

const retentionTargetDays: Record<HomeRetentionMilestoneId, number> = {
  day1: 1,
  day3: 3,
  day7: 7,
  day14: 14,
  day30: 30
};

const retentionTitleByMilestone: Record<HomeRetentionMilestoneId, LocalizedText> = {
  day1: { "en-US": "First daily hello", "ko-KR": "첫 번째 인사", "ja-JP": "最初の毎日のあいさつ", "zh-TW": "第一次每日問候", "de-DE": "Erster Tagesgruß", "fr-FR": "Premier bonjour quotidien", "pt-BR": "Primeiro olá do dia", "es-MX": "Primer saludo diario" },
  day3: { "en-US": "Snack rhythm", "ko-KR": "간식 리듬", "ja-JP": "おやつのリズム", "zh-TW": "點心節奏", "de-DE": "Leckerli-Rhythmus", "fr-FR": "Rythme des friandises", "pt-BR": "Ritmo dos petiscos", "es-MX": "Ritmo de premios" },
  day7: { "en-US": "One-week memory", "ko-KR": "일주일의 추억", "ja-JP": "1週間の思い出", "zh-TW": "一週回憶", "de-DE": "Eine Woche Erinnerungen", "fr-FR": "Souvenir d’une semaine", "pt-BR": "Memória de uma semana", "es-MX": "Recuerdo de una semana" },
  day14: { "en-US": "Two-week rhythm", "ko-KR": "두 주의 리듬", "ja-JP": "2週間のリズム", "zh-TW": "兩週節奏", "de-DE": "Zwei-Wochen-Rhythmus", "fr-FR": "Rythme de deux semaines", "pt-BR": "Ritmo de duas semanas", "es-MX": "Ritmo de dos semanas" },
  day30: { "en-US": "One-month letter", "ko-KR": "한 달의 편지", "ja-JP": "1か月の手紙", "zh-TW": "滿月信", "de-DE": "Ein-Monats-Brief", "fr-FR": "Lettre du premier mois", "pt-BR": "Carta do primeiro mês", "es-MX": "Carta del primer mes" }
};

const careLineByMilestone: Record<HomeRetentionMilestoneId, LocalizedText> = {
  day1: { "en-US": "Give {petName} one tiny care action to start today's bond.", "ko-KR": "{petName}를 한 번 돌보며 오늘의 유대감을 시작해 보세요.", "ja-JP": "{petName}をひとつお世話して、今日の絆を始めましょう。", "zh-TW": "給 {petName} 一次小小照顧，開啟今天的感情時光。", "de-DE": "Schenke {petName} einen kleinen Pflegemoment und beginnt eure heutige Verbundenheit.", "fr-FR": "Offrez un petit soin à {petName} pour commencer votre complicité du jour.", "pt-BR": "Dê um pequeno cuidado a {petName} para começar o vínculo de hoje.", "es-MX": "Dale un pequeño cuidado a {petName} para comenzar el vínculo de hoy." },
  day3: { "en-US": "Day 3 starts the snack rhythm. A little care can bring treats home.", "ko-KR": "3일째에는 간식 리듬이 시작돼요. 작은 돌봄이 간식을 데려올 수 있어요.", "ja-JP": "3日目からおやつのリズムが始まります。小さなお世話がおやつにつながります。", "zh-TW": "第 3 天開啟點心節奏。小小照顧可能會帶點心回家。", "de-DE": "An Tag 3 beginnt der Leckerli-Rhythmus. Ein kleiner Pflegemoment kann Leckerlis nach Hause bringen.", "fr-FR": "Le 3e jour lance le rythme des friandises. Un petit soin peut en faire arriver à la maison.", "pt-BR": "O dia 3 começa o ritmo dos petiscos. Um pequeno cuidado pode trazer petiscos para casa.", "es-MX": "El día 3 inicia el ritmo de premios. Un pequeño cuidado puede traer premios a casa." },
  day7: { "en-US": "Keep today cozy so the one-week memory has something to hold.", "ko-KR": "오늘도 포근하게 돌보면 일주일의 추억이 더 선명해져요.", "ja-JP": "今日もやさしくお世話して、1週間の思い出をあたためましょう。", "zh-TW": "今天也溫柔照顧，讓一週回憶有更多暖暖的片段。", "de-DE": "Macht es euch heute gemütlich, damit die Wochenerinnerung etwas Schönes bewahrt.", "fr-FR": "Gardez cette journée douillette pour nourrir le souvenir de votre première semaine.", "pt-BR": "Deixe o dia aconchegante para guardar algo bonito na memória da primeira semana.", "es-MX": "Mantén el día acogedor para llenar de cariño el recuerdo de la primera semana." },
  day14: { "en-US": "{petName} is learning your rhythm. One care moment keeps it warm.", "ko-KR": "{petName}가 당신의 리듬을 배우고 있어요. 작은 돌봄 한 번으로 이어가 주세요.", "ja-JP": "{petName}はあなたのリズムを覚えています。ひとつのお世話で、ぬくもりを続けましょう。", "zh-TW": "{petName} 正在熟悉你的節奏。一次小照顧就能讓這份溫暖延續。", "de-DE": "{petName} lernt deinen Rhythmus kennen. Ein Pflegemoment hält ihn warm.", "fr-FR": "{petName} apprend votre rythme. Un petit soin suffit à le garder chaleureux.", "pt-BR": "{petName} está aprendendo seu ritmo. Um momento de cuidado mantém tudo quentinho.", "es-MX": "{petName} está aprendiendo tu ritmo. Un momento de cuidado lo mantiene cálido." },
  day30: { "en-US": "The one-month letter is ahead. Today can become part of it.", "ko-KR": "한 달의 편지가 다가오고 있어요. 오늘도 편지 속 이야기가 될 수 있어요.", "ja-JP": "1か月の手紙までもう少し。今日もその物語の一部になります。", "zh-TW": "滿月信就快到了。今天也會成為信裡的一段故事。", "de-DE": "Der Ein-Monats-Brief rückt näher. Auch heute kann ein Teil davon werden.", "fr-FR": "La lettre du premier mois approche. Cette journée peut aussi en faire partie.", "pt-BR": "A carta do primeiro mês está chegando. Hoje também pode fazer parte dela.", "es-MX": "La carta del primer mes se acerca. Hoy también puede formar parte de ella." }
};

const completedLineByMilestone: Record<HomeRetentionMilestoneId, LocalizedText> = {
  day1: { "en-US": "{petName} felt today's first hello. Tomorrow keeps the rhythm warm.", "ko-KR": "{petName}가 오늘의 첫 인사를 느꼈어요. 내일도 이 포근한 리듬을 이어가요.", "ja-JP": "{petName}に今日の最初のあいさつが届きました。明日もこのやさしいリズムを続けましょう。", "zh-TW": "{petName} 收到今天的第一聲問候了。明天也繼續這個溫暖節奏吧。", "de-DE": "{petName} hat den ersten Gruß des Tages gespürt. Morgen bleibt der Rhythmus schön warm.", "fr-FR": "{petName} a reçu le premier bonjour du jour. Demain gardera ce doux rythme.", "pt-BR": "{petName} sentiu o primeiro olá de hoje. Amanhã mantém esse ritmo quentinho.", "es-MX": "{petName} sintió el primer saludo de hoy. Mañana mantendrá cálido este ritmo." },
  day3: { "en-US": "The snack rhythm is waking up. Your next tiny care keeps it alive.", "ko-KR": "간식 리듬이 깨어나고 있어요. 다음 작은 돌봄으로 이어가 주세요.", "ja-JP": "おやつのリズムが目を覚ましています。次の小さなお世話で続いていきます。", "zh-TW": "點心節奏正在甦醒。下一次小照顧會讓它繼續下去。", "de-DE": "Der Leckerli-Rhythmus erwacht. Dein nächster kleiner Pflegemoment hält ihn lebendig.", "fr-FR": "Le rythme des friandises s’éveille. Votre prochain petit soin le fera vivre.", "pt-BR": "O ritmo dos petiscos está despertando. Seu próximo pequeno cuidado o mantém vivo.", "es-MX": "El ritmo de premios está despertando. Tu próximo pequeño cuidado lo mantendrá vivo." },
  day7: { "en-US": "Your one-week memory is close. The scrapbook is starting to feel yours.", "ko-KR": "일주일의 추억이 가까워졌어요. 추억책이 조금씩 우리 이야기로 채워지고 있어요.", "ja-JP": "1週間の思い出までもう少し。スクラップブックが少しずつふたりらしくなっています。", "zh-TW": "一週回憶就快完成了。剪貼簿正一點點裝滿你們的故事。", "de-DE": "Eure Wochenerinnerung ist nah. Das Sammelbuch fühlt sich langsam ganz nach euch an.", "fr-FR": "Le souvenir d’une semaine approche. L’album commence à raconter votre histoire.", "pt-BR": "A memória de uma semana está perto. O álbum já começa a ter a cara de vocês.", "es-MX": "El recuerdo de una semana está cerca. El álbum empieza a sentirse muy suyo." },
  day14: { "en-US": "Two weeks turns care into a habit your pet can recognize.", "ko-KR": "두 주의 돌봄이 우리 친구가 알아보는 습관이 되고 있어요.", "ja-JP": "2週間のお世話が、ペットにもわかるやさしい習慣になっています。", "zh-TW": "兩週的照顧，正變成毛孩熟悉的溫柔習慣。", "de-DE": "Zwei Wochen machen Pflege zu einer Gewohnheit, die dein Tier wiedererkennt.", "fr-FR": "Deux semaines transforment les soins en une habitude que votre compagnon reconnaît.", "pt-BR": "Duas semanas transformam o cuidado em um hábito que seu pet reconhece.", "es-MX": "Dos semanas convierten el cuidado en un hábito que tu mascota reconoce." },
  day30: { "en-US": "The one-month letter is ahead. Your profile is collecting the story.", "ko-KR": "한 달의 편지가 다가오고 있어요. 프로필에 우리 이야기가 쌓이고 있어요.", "ja-JP": "1か月の手紙までもう少し。プロフィールにふたりの物語が積み重なっています。", "zh-TW": "滿月信就快到了。你們的故事正在個人檔案裡慢慢累積。", "de-DE": "Der Ein-Monats-Brief rückt näher. Euer Profil sammelt eure Geschichte.", "fr-FR": "La lettre du premier mois approche. Votre profil rassemble votre histoire.", "pt-BR": "A carta do primeiro mês está chegando. O perfil está reunindo a história de vocês.", "es-MX": "La carta del primer mes se acerca. Su perfil está reuniendo la historia." }
};

const retentionToneByMilestone: Record<HomeRetentionMilestoneId, HomeRetentionPromptTone> = {
  day1: "daily",
  day3: "reward",
  day7: "memory",
  day14: "memory",
  day30: "letter"
};

const getHomeRetentionMilestoneId = (daysTogether: number): HomeRetentionMilestoneId => {
  if (daysTogether >= 15) {
    return "day30";
  }

  if (daysTogether >= 8) {
    return "day14";
  }

  if (daysTogether >= 4) {
    return "day7";
  }

  if (daysTogether >= 2) {
    return "day3";
  }

  return "day1";
};

const getRetentionProgressLabel = (milestoneId: HomeRetentionMilestoneId, daysTogether: number): string => {
  const targetDay = retentionTargetDays[milestoneId];
  const displayDay = Math.max(1, Math.min(targetDay, daysTogether));

  return `D${displayDay} / D${targetDay}`;
};

interface HomeRetentionCopyInput {
  readonly milestoneId: HomeRetentionMilestoneId;
  readonly petName: string;
  readonly daysTogether: number;
  readonly hasCaredToday: boolean;
  readonly hasOpenedMonthlyLetter: boolean;
  readonly locale: AppLocale;
}

const getHomeRetentionCopy = ({
  milestoneId,
  petName,
  daysTogether,
  hasCaredToday,
  hasOpenedMonthlyLetter,
  locale
}: HomeRetentionCopyInput): Pick<HomeRetentionPromptPresentation, "title" | "line" | "ctaLabel" | "action"> => {
  const title = getLocalizedText(locale, retentionTitleByMilestone[milestoneId]);
  const careCta = getLocalizedText(locale, milestoneId === "day1"
    ? { "en-US": "Care now", "ko-KR": "지금 돌보기", "ja-JP": "今お世話する", "zh-TW": "現在照顧", "de-DE": "Jetzt pflegen", "fr-FR": "Prendre soin", "pt-BR": "Cuidar agora", "es-MX": "Cuidar ahora" }
    : { "en-US": "Care today", "ko-KR": "오늘 돌보기", "ja-JP": "今日お世話する", "zh-TW": "今天照顧", "de-DE": "Heute pflegen", "fr-FR": "Prendre soin aujourd’hui", "pt-BR": "Cuidar hoje", "es-MX": "Cuidar hoy" });
  const letterIsWaiting = milestoneId === "day30" && daysTogether >= 30 && !hasOpenedMonthlyLetter;

  if (!hasCaredToday && !letterIsWaiting) {
    return {
      title,
      line: getLocalizedText(locale, careLineByMilestone[milestoneId]).replaceAll("{petName}", petName),
      ctaLabel: careCta,
      action: "care"
    };
  }

  if (letterIsWaiting) {
    return {
      title,
      line: getLocalizedText(locale, {
        "en-US": "{petName} left a letter from your first month together.",
        "ko-KR": "{petName}가 함께한 첫 한 달의 편지를 남겼어요.",
        "ja-JP": "{petName}が一緒に過ごした最初の1か月の手紙を残しました。",
        "zh-TW": "{petName} 留下了一封關於你們第一個月的信。",
        "de-DE": "{petName} hat einen Brief über euren ersten gemeinsamen Monat hinterlassen.",
        "fr-FR": "{petName} a laissé une lettre sur votre premier mois ensemble.",
        "pt-BR": "{petName} deixou uma carta sobre o primeiro mês de vocês juntos.",
        "es-MX": "{petName} dejó una carta sobre su primer mes juntos."
      }).replaceAll("{petName}", petName),
      ctaLabel: getLocalizedText(locale, { "en-US": "Open letter", "ko-KR": "편지 열기", "ja-JP": "手紙を開く", "zh-TW": "打開信件", "de-DE": "Brief öffnen", "fr-FR": "Ouvrir la lettre", "pt-BR": "Abrir carta", "es-MX": "Abrir carta" }),
      action: "friend"
    };
  }

  return {
    title,
    line: getLocalizedText(locale, completedLineByMilestone[milestoneId]).replaceAll("{petName}", petName),
    ctaLabel: getLocalizedText(locale, { "en-US": "See profile", "ko-KR": "프로필 보기", "ja-JP": "プロフィールを見る", "zh-TW": "查看個人檔案", "de-DE": "Profil ansehen", "fr-FR": "Voir le profil", "pt-BR": "Ver perfil", "es-MX": "Ver perfil" }),
    action: "friend"
  };
};

const collapseAccessibilityLabelText: LocalizedText = {
  "en-US": "Hide for today",
  "ko-KR": "오늘 하루 접어두기",
  "ja-JP": "今日はしまう",
  "zh-TW": "今天先收起",
  "de-DE": "Für heute ausblenden",
  "fr-FR": "Masquer pour aujourd’hui",
  "pt-BR": "Ocultar por hoje",
  "es-MX": "Ocultar por hoy"
};

const chipExpandHintText: LocalizedText = {
  "en-US": "Tap to expand",
  "ko-KR": "탭하면 펼쳐져요",
  "ja-JP": "タップで広がります",
  "zh-TW": "點一下展開",
  "de-DE": "Zum Ausklappen tippen",
  "fr-FR": "Toucher pour développer",
  "pt-BR": "Toque para expandir",
  "es-MX": "Toca para expandir"
};

export const getHomeRetentionPromptPresentation = ({
  petName,
  daysTogether,
  hasCaredToday,
  hasOpenedMonthlyLetter,
  isOnWalk,
  locale = "en-US"
}: {
  readonly petName: string;
  readonly daysTogether: number;
  readonly hasCaredToday: boolean;
  readonly hasOpenedMonthlyLetter: boolean;
  readonly isOnWalk: boolean;
  readonly locale?: AppLocale;
}): HomeRetentionPromptPresentation | null => {
  if (isOnWalk) {
    return null;
  }

  const normalizedDaysTogether = Math.max(0, Math.floor(daysTogether));
  const milestoneId = getHomeRetentionMilestoneId(normalizedDaysTogether);
  const copy = getHomeRetentionCopy({
    milestoneId,
    petName,
    daysTogether: normalizedDaysTogether,
    hasCaredToday,
    hasOpenedMonthlyLetter,
    locale
  });
  const progressLabel = getRetentionProgressLabel(milestoneId, normalizedDaysTogether);

  return {
    milestoneId,
    eyebrow: `D${retentionTargetDays[milestoneId]}`,
    title: copy.title,
    line: copy.line,
    ctaLabel: copy.ctaLabel,
    action: copy.action,
    progressLabel,
    tone: retentionToneByMilestone[milestoneId],
    accessibilityLabel: `${copy.title}. ${copy.line} ${copy.ctaLabel}. ${progressLabel}.`,
    collapseAccessibilityLabel: getLocalizedText(locale, collapseAccessibilityLabelText),
    chipAccessibilityLabel: `${copy.title}. ${getLocalizedText(locale, chipExpandHintText)}.`
  };
};
