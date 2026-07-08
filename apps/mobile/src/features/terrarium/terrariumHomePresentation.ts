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
  WalkSession
} from "@mongchi/shared";

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

const feedbackTitleByAction: Record<CareActionType, string> = {
  feed: "Bowl filled",
  talk: "Hello shared",
  walk: "Path started",
  play: "Play time",
  rest: "Rested",
  affection: "Gentle pet",
  water_garden: "Water served",
  clean: "Fresh again",
  treat: "Treat joy"
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

const careDeltaFields: Array<{ key: keyof Pick<CareState, "satiety" | "happiness" | "energy" | "cleanliness" | "gardenHealth" | "affection">; label: string }> = [
  { key: "satiety", label: "Food" },
  { key: "happiness", label: "Mood" },
  { key: "energy", label: "Energy" },
  { key: "cleanliness", label: "Clean" },
  { key: "gardenHealth", label: "Water" },
  { key: "affection", label: "Affection" }
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

const getRewardLine = (reward: CareActionReward): string | null => {
  if (reward.type === "item") {
    return `Item x${reward.quantity}`;
  }

  return null;
};

export const getHomeCareActionFeedbackPresentation = ({
  action,
  previousCareState,
  nextCareState,
  previousRelationshipState,
  nextRelationshipState,
  reward
}: {
  action: CareActionType;
  previousCareState: CareState;
  nextCareState: CareState;
  previousRelationshipState: RelationshipState;
  nextRelationshipState: RelationshipState;
  reward?: CareActionReward | null;
}): HomeCareActionFeedbackPresentation => {
  const careDeltas = careDeltaFields
    .map(({ key, label }) => ({
      label,
      value: nextCareState[key] - previousCareState[key]
    }))
    .filter((delta) => delta.value !== 0);
  const bondDelta = nextRelationshipState.bondXp - previousRelationshipState.bondXp;
  const deltas = [
    ...careDeltas,
    ...(bondDelta !== 0
      ? [
          {
            label: "Bond",
            value: bondDelta
          }
        ]
      : [])
  ];
  const rewardLine = reward ? getRewardLine(reward) : null;
  const visibleDeltas = deltas.slice(0, rewardLine ? 2 : 3);
  // Walk numbers read as a spreadsheet ("Path started · Mood +12 · Energy
  // -12"), which breaks the no-raw-numbers rule — tell it as a moment instead.
  const walkStartedLine = action === "walk" ? "Mong trotted off to the path." : null;
  const line =
    walkStartedLine ??
    rewardLine ??
    (visibleDeltas.length > 0
      ? visibleDeltas.map(formatDelta).join(" · ")
      : "Care rhythm updated.");
  const tone = getCareActionTone(action, deltas, reward ?? null);
  const accessibilityDetail =
    walkStartedLine ?? rewardLine ?? (deltas.length > 0 ? deltas.map(formatDelta).join(", ") : "Care rhythm updated.");

  return {
    icon: reward ? "reward" : feedbackIconByAction[action],
    tone,
    title: feedbackTitleByAction[action],
    line,
    deltas,
    accessibilityLabel: `${feedbackTitleByAction[action]}. ${accessibilityDetail}`
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
  momentOverrideLine = null
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
}): HomeThoughtPresentation => {
  // A celebration reaction (bond level-up, walk discovery, walk-journal
  // complete) always owns the bubble outright -- it must never lose to a
  // return greeting, a generic "you fed me" recent-action line, an urgent
  // need, or a weather/time line, all of which selectPetStatusLine would
  // otherwise prefer ahead of the reaction itself.
  if (isCelebrationReaction(reaction)) {
    return {
      icon: getReactionIcon(reaction),
      line: reaction.line,
      accessibilityLabel: reaction.line
    };
  }

  if (momentOverrideLine) {
    return {
      icon: "heart",
      line: momentOverrideLine,
      accessibilityLabel: momentOverrideLine
    };
  }

  // Night care acknowledgement: same "owns the bubble outright" precedence
  // as a celebration, but checked second so a genuine celebration (e.g. a
  // bond level-up that happens to land at night) still wins -- a rare, happy
  // moment is more worth surfacing than the routine sleepy-thanks line.
  if (isShowingNightCareAcknowledgement) {
    return {
      icon: "heart",
      line: NIGHT_CARE_ACKNOWLEDGEMENT_LINE,
      accessibilityLabel: `${petName} sleepily thanks you and settles back down. ${NIGHT_CARE_ACKNOWLEDGEMENT_LINE}`
    };
  }

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

  if (episodeLine && preferEpisodeLine && AMBIENT_STATUS_SOURCES.has(status.source)) {
    return {
      icon: "heart",
      line: episodeLine.line,
      accessibilityLabel: episodeLine.line
    };
  }

  return {
    icon: status.source === "reaction" ? getReactionIcon(reaction) : iconByStatusNeed[status.need],
    line: status.line,
    accessibilityLabel: status.accessibilityLabel
  };
};

export const getHomeWalkCtaPresentation = (
  activeWalk: WalkSession | null,
  petName: string,
  secondsLeft: number
): HomeWalkCtaPresentation => {
  if (!activeWalk || activeWalk.status === "claimed" || activeWalk.status === "expired") {
    return {
      status: "start",
      label: "Path",
      line: `${petName} can take a tiny walk.`,
      accessibilityLabel: `Start a tiny walk with ${petName}.`
    };
  }

  if (activeWalk.status === "walking") {
    return {
      status: "walking",
      label: `${Math.max(0, secondsLeft)}s`,
      line: `${petName} is already on the path.`,
      accessibilityLabel: `${petName} is walking. Returning in ${Math.max(0, secondsLeft)} seconds.`
    };
  }

  if (activeWalk.status === "returned") {
    return {
      status: "start",
      label: "Path",
      line: `${petName} came back refreshed.`,
      accessibilityLabel: `Start another tiny walk with ${petName}.`
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
export const getHomeStreakTogglePresentation = (streakDays: number): HomeEventTogglePresentation | null => {
  if (streakDays <= 0) {
    return null;
  }

  const line = streakDays === 1 ? "Day 1 of your care streak! Off to a warm start." : `${streakDays} days in a row. This little garden loves the rhythm.`;

  return {
    id: `streak-${streakDays}`,
    line,
    accessibilityLabel: `Care streak: ${streakDays} day${streakDays === 1 ? "" : "s"} in a row.`
  };
};

/** Fires once the instant a buff is granted — no persistent chip. */
export const getHomeBuffTogglePresentation = (buff: Pick<ActiveCareBuff, "buffId" | "labelEn">): HomeEventTogglePresentation => ({
  id: buff.buffId,
  line: `${buff.labelEn} is active!`,
  accessibilityLabel: `${buff.labelEn} effect just started.`
});

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
const daysMilestoneToastLineByDays: Record<number, string> = {
  7: "A whole week together.",
  14: "Two weeks of little hellos.",
  30: "One month. {name} left you a letter."
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
  now: string
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

  const line = lineTemplate.replace("{name}", petName);

  return {
    id: `days-milestone-${daysTogether}`,
    line,
    accessibilityLabel: `Milestone reached: ${line}`
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
export const getBondLevelUpTogglePresentation = (level: number): HomeEventTogglePresentation => {
  const reward = bondLevelRewards[level];
  const hasReward = Boolean(reward?.wallet || (reward?.items && reward.items.length > 0));
  const line = hasReward
    ? `Lv ${level} — we're getting closer. A little something extra landed in your things.`
    : `Lv ${level} — we're getting closer.`;

  return {
    id: `bond-level-${level}`,
    line,
    accessibilityLabel: `Bond level up: level ${level}. ${hasReward ? "A small reward arrived too." : ""}`.trim()
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
  rarity: "common" | "rare"
): HomeEventTogglePresentation => ({
  id: `walk-discovery-${collectibleName}`,
  line: `New find: ${collectibleName}`,
  accessibilityLabel:
    rarity === "rare"
      ? `New rare find: ${collectibleName}. This one is really special.`
      : `New find: ${collectibleName}.`
});

/**
 * Fires once the moment the walk journal (9 collectibles) is completed (see
 * claimPrototypeWalkReward's collectionCompleted flag) -- names the reward
 * without a number so the "quietly credited" feeling the task brief calls
 * out gets a clear, warm acknowledgement instead.
 */
export const getWalkCollectionCompleteTogglePresentation = (): HomeEventTogglePresentation => ({
  id: "walk-collection-complete",
  line: "Walk journal complete! A little thank-you went into your wallet.",
  accessibilityLabel: "Walk journal complete. A thank-you reward was added to your wallet."
});

/**
 * Fires once when an expression pack purchase finishes and its new assets
 * land in acceptedAssets (see purchaseExpressionPack's poll effect in
 * TerrariumSessionProvider) -- surfaced here rather than only on the friend
 * page, since the poll keeps running after navigating home. Returns null for
 * an unknown pack id so a stale/removed pack can never crash this toast.
 */
export const getExpressionPackUnlockedTogglePresentation = (packId: string, petName: string): HomeEventTogglePresentation | null => {
  const pack = getExpressionPackById(packId);

  if (!pack) {
    return null;
  }

  return {
    id: `expression-pack-${packId}`,
    line: `${petName} learned some new expressions!`,
    accessibilityLabel: `${petName} unlocked the ${pack.nameEn} expression pack.`
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

const hudMeterGuideCopy: Record<HudMeterKey, HudMeterGuideCopy> = {
  fullness: {
    key: "fullness",
    title: "Full",
    description: "How satisfied your pet's tummy is feeling.",
    howTo: "A good meal fills this right up."
  },
  thirst: {
    key: "thirst",
    title: "Water",
    description: "Fresh water keeps your buddy happily hydrated.",
    howTo: "A fresh bowl of water tops this right off."
  },
  mood: {
    key: "mood",
    title: "Mood",
    description: "How happy and loved your pet feels right now.",
    howTo: "A little play or a good pet lifts this fast."
  },
  energy: {
    key: "energy",
    title: "Energy",
    description: "How rested and ready to play your pet is.",
    howTo: "Some rest — or a good meal — brings this right back."
  },
  cleanliness: {
    key: "cleanliness",
    title: "Clean",
    description: "How fresh and tidy your pet is feeling.",
    howTo: "A warm bath freshens this right up."
  }
};

const hudMeterStatusLineByBand: Record<HudMeterKey, Record<CareStatBand, string>> = {
  fullness: {
    critical: "Feeling quite empty — a meal would go a long way.",
    low: "Getting a little hungry over here.",
    okay: "Comfortably fed for now.",
    great: "Happily full and content."
  },
  thirst: {
    critical: "Feeling quite parched — a fresh bowl would help a lot.",
    low: "Getting a little thirsty over here.",
    okay: "Nicely hydrated.",
    great: "Happily hydrated and refreshed."
  },
  mood: {
    critical: "Feeling a little low today — some attention would help.",
    low: "Could use a small pick-me-up.",
    okay: "Feeling good.",
    great: "Absolutely glowing with happiness."
  },
  energy: {
    critical: "Running on empty — rest would help a lot.",
    low: "A little tired.",
    okay: "Feeling steady.",
    great: "Bursting with energy."
  },
  cleanliness: {
    critical: "Feeling pretty grubby — a bath would feel really nice.",
    low: "Getting a little dusty over here.",
    okay: "Comfortably clean for now.",
    great: "So fresh and clean!"
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
export const getHudMeterGuidePresentation = (key: HudMeterKey, value: number): HudMeterGuidePresentation => {
  const copy = hudMeterGuideCopy[key];
  const band = getCareStatBand(value);
  const statusLine = hudMeterStatusLineByBand[key][band];

  return {
    title: copy.title,
    description: copy.description,
    howTo: copy.howTo,
    actionIcons: hudMeterActionIconsByKey[key],
    statusLine,
    accessibilityLabel: `${copy.title}. ${copy.howTo} ${statusLine}`
  };
};
