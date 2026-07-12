import { describe, expect, it } from "vitest";

import {
  createManualWeatherContext,
  createSeededRandom,
  mockCareState,
  mockPetProfile,
  selectEpisode,
  selectLocalReaction,
  starterReactionRules
} from "../index";
import type { Locale, ReactionRule } from "../index";

const localizedFallbackCases: readonly { locale: Locale; expectedLine: string }[] = [
  { locale: "ja-JP", expectedLine: "Misoは静かにそばにいるよ。" },
  { locale: "pt-BR", expectedLine: "Miso está quietinho aqui com você." }
];

describe("local reaction selection", () => {
  it.each(localizedFallbackCases)("uses a localized safe fallback for $locale when no authored locale rules exist", ({
    locale,
    expectedLine
  }) => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale,
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(reaction.ruleId).toBe("fallback_local_safe");
    expect(reaction.line).toBe(expectedLine);
  });

  it("prefers urgent hungry reactions over general greetings", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "ko-KR",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: {
          ...mockCareState,
          satiety: 12
        },
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("hungry_low");
    expect(reaction.ruleId).toBe("ko_hungry_critical_001");
  });

  it("uses event-specific reveal copy when a pet is accepted", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "ko-KR",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        eventContext: "generation_reveal",
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("generation_reveal");
    expect(reaction.line).toContain("정원");
  });

  it("uses a rested reaction after the rest care action", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        recentAction: "rest",
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("rested");
    expect(reaction.ruleId).toBe("en_rested_001");
  });

  it("uses a clean_done reaction after the clean (bath) care action", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        recentAction: "clean",
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("clean_done");
    expect(reaction.ruleId).toBe("en_clean_done_001");
    expect(reaction.animation).toBe("happy");
  });

  it("prefers a soft return reaction after days away", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "en-US",
        now: "2026-06-26T09:00:00.000Z",
        pet: mockPetProfile,
        careState: {
          ...mockCareState,
          satiety: 8
        },
        daysAway: 2,
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("missed_one_day");
    expect(reaction.ruleId).toBe("en_missed_soft_001");
  });

  it("uses weather-aware ambient lines when care is stable", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "en-US",
        now: "2026-06-24T13:00:00.000Z",
        pet: mockPetProfile,
        careState: {
          ...mockCareState,
          satiety: 80,
          gardenHealth: 80
        },
        weather: createManualWeatherContext("rain", "2026-06-24T13:00:00.000Z"),
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.category).toBe("weather_rain");
    expect(reaction.ruleId).toBe("en_weather_rain_home_001");
  });

  it("prefers rainy walk copy over the generic walk start line", () => {
    const reaction = selectLocalReaction(
      starterReactionRules,
      {
        locale: "en-US",
        now: "2026-06-24T13:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        recentAction: "walk",
        weather: createManualWeatherContext("rain", "2026-06-24T13:00:00.000Z"),
        recentReactions: []
      },
      {
        random: () => 0
      }
    );

    expect(reaction.ruleId).toBe("en_weather_rain_walk_001");
  });

  it("returns an episode with matching weather scene presentation", () => {
    const episode = selectEpisode(
      starterReactionRules,
      {
        trigger: "app_open",
        locale: "en-US",
        now: "2026-06-24T13:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        weather: createManualWeatherContext("snow", "2026-06-24T13:00:00.000Z"),
        recentReactions: []
      },
      "home",
      {
        random: () => 0
      }
    );

    expect(episode.weatherScene.overlayKey).toBe("snow");
    expect(episode.weatherScene.backgroundKey).toBe("home-garden-winter");
  });
});

describe("relationship-depth conditions (bondLevelMin / daysTogetherMin / streakMin / requiresFavoriteThing)", () => {
  const bondRule: ReactionRule = {
    id: "test_bond_gate",
    locale: "en-US",
    category: "affection_high",
    conditions: { bondLevelMin: 5 },
    lines: ["Bond-gated line."],
    animation: "idle_happy",
    priority: 50,
    cooldownHours: 0,
    safetyLevel: "safe"
  };

  const daysTogetherRule: ReactionRule = {
    id: "test_days_together_gate",
    locale: "en-US",
    category: "affection_high",
    conditions: { daysTogetherMin: 30 },
    lines: ["Days-together-gated line."],
    animation: "idle_happy",
    priority: 50,
    cooldownHours: 0,
    safetyLevel: "safe"
  };

  const streakRule: ReactionRule = {
    id: "test_streak_gate",
    locale: "en-US",
    category: "affection_high",
    conditions: { streakMin: 7 },
    lines: ["Streak-gated line."],
    animation: "idle_happy",
    priority: 50,
    cooldownHours: 0,
    safetyLevel: "safe"
  };

  const favoriteThingRule: ReactionRule = {
    id: "test_favorite_thing_gate",
    locale: "en-US",
    category: "affection_high",
    conditions: { requiresFavoriteThing: true },
    lines: ["I love {favoriteThing}."],
    animation: "idle_happy",
    priority: 50,
    cooldownHours: 0,
    safetyLevel: "safe"
  };

  it("does not select a bondLevelMin rule when bondLevel is below the threshold", () => {
    const reaction = selectLocalReaction(
      [bondRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        bondLevel: 2,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(reaction.ruleId).not.toBe("test_bond_gate");
  });

  it("selects a bondLevelMin rule once bondLevel meets the threshold", () => {
    const reaction = selectLocalReaction(
      [bondRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        bondLevel: 5,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(reaction.ruleId).toBe("test_bond_gate");
  });

  it("gates a daysTogetherMin rule on the daysTogether context value", () => {
    const belowThreshold = selectLocalReaction(
      [daysTogetherRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        daysTogether: 10,
        recentReactions: []
      },
      { random: () => 0 }
    );
    const atThreshold = selectLocalReaction(
      [daysTogetherRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        daysTogether: 30,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(belowThreshold.ruleId).not.toBe("test_days_together_gate");
    expect(atThreshold.ruleId).toBe("test_days_together_gate");
  });

  it("gates a streakMin rule on the streak context value", () => {
    const belowThreshold = selectLocalReaction(
      [streakRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        streak: 3,
        recentReactions: []
      },
      { random: () => 0 }
    );
    const atThreshold = selectLocalReaction(
      [streakRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: mockPetProfile,
        careState: mockCareState,
        streak: 7,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(belowThreshold.ruleId).not.toBe("test_streak_gate");
    expect(atThreshold.ruleId).toBe("test_streak_gate");
  });

  it("never selects a requiresFavoriteThing rule for a pet with no favoriteThing", () => {
    const petWithoutFavoriteThing = { ...mockPetProfile };
    delete petWithoutFavoriteThing.favoriteThing;

    const reaction = selectLocalReaction(
      [favoriteThingRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: petWithoutFavoriteThing,
        careState: mockCareState,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(reaction.ruleId).not.toBe("test_favorite_thing_gate");
  });

  it("selects a requiresFavoriteThing rule and fills the placeholder for a pet with a favoriteThing", () => {
    const reaction = selectLocalReaction(
      [favoriteThingRule],
      {
        locale: "en-US",
        now: "2026-06-24T09:00:00.000Z",
        pet: { ...mockPetProfile, favoriteThing: "cloud-shaped leaves" },
        careState: mockCareState,
        recentReactions: []
      },
      { random: () => 0 }
    );

    expect(reaction.ruleId).toBe("test_favorite_thing_gate");
    expect(reaction.line).toBe("I love cloud-shaped leaves.");
  });
});

describe("createSeededRandom", () => {
  it("returns the same sequence of values for the same seed", () => {
    const first = createSeededRandom("pet-1|okay|clear|calm|123");
    const second = createSeededRandom("pet-1|okay|clear|calm|123");

    expect(first()).toBe(second());
    expect(first()).toBe(second());
    expect(first()).toBe(second());
  });

  it("returns values in the [0, 1) range expected by Math.random()-style callers", () => {
    const random = createSeededRandom("some-seed");

    for (let index = 0; index < 20; index += 1) {
      const value = random();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = createSeededRandom("seed-a")();
    const b = createSeededRandom("seed-b")();

    expect(a).not.toBe(b);
  });

  it("keeps selectLocalReaction's pick stable across repeated calls with the same seed", () => {
    const context = {
      locale: "en-US" as const,
      now: "2026-06-24T13:00:00.000Z",
      pet: mockPetProfile,
      careState: { ...mockCareState, satiety: 80, gardenHealth: 80 },
      recentReactions: []
    };

    const first = selectLocalReaction(starterReactionRules, context, { random: createSeededRandom("ambient-seed") });
    const second = selectLocalReaction(starterReactionRules, context, { random: createSeededRandom("ambient-seed") });

    expect(second.ruleId).toBe(first.ruleId);
    expect(second.line).toBe(first.line);
  });

  it("produces varied output values across many different seeds, unlike a frozen fixed pick", () => {
    const values = new Set(
      Array.from({ length: 30 }, (_, index) => Math.floor(createSeededRandom(`seed-${index}`)() * 1000))
    );

    expect(values.size).toBeGreaterThan(1);
  });
});
