import { describe, expect, it } from "vitest";

import type { MemoryEntry, SelectedReaction, WalkSession } from "@mongchi/shared";
import { applyLocalCareAction, applyRelationshipCareAction, mockCareState, mockRelationshipState } from "@mongchi/shared";

import {
  getAmbientReactionSeed,
  getBondLevelToastPersistedKey,
  getBondLevelUpTogglePresentation,
  getBuffToastPersistedKey,
  getDaysMilestoneToastPersistedKey,
  getDaysMilestoneTogglePresentation,
  getFriendEntryBadgeVisible,
  getHomeBuffTogglePresentation,
  getHomeCareActionFeedbackPresentation,
  getHomeStreakTogglePresentation,
  getHomeThoughtPresentation,
  getHomeWalkCtaPresentation,
  getHomeWalkPanelVisibility,
  getHudMeterGuidePresentation,
  getStreakToastPersistedKey,
  getWalkCollectionCompleteTogglePresentation,
  getLocalizedWalkCollectibleName,
  getWalkDiscoveryCardPresentation,
  isCelebrationReaction,
  pruneEventToastPersistedKeys
} from "./terrariumHomePresentation";

const idleReaction: SelectedReaction = {
  ruleId: "idle",
  category: "greeting_morning",
  line: "You came back. This tiny home feels warmer now.",
  animation: "idle_happy",
  priority: 40
};

const walking: WalkSession = {
  id: "walk_001",
  userId: "user_demo_001",
  petId: "pet_miso_001",
  status: "walking",
  startedAt: "2026-06-24T09:00:00.000Z",
  returnAt: "2026-06-24T09:00:30.000Z",
  rewardItemIds: ["item_flower_pot_sunny"],
  energyCost: 12,
  createdAt: "2026-06-24T09:00:00.000Z",
  updatedAt: "2026-06-24T09:00:00.000Z"
};

describe("terrarium home presentation", () => {
  it("uses the current care need for the home thought bubble", () => {
    expect(
      getHomeThoughtPresentation({
        petName: "Miso",
        reaction: idleReaction,
        satisfactionSummary: {
          primaryNeed: "food",
          hint: "A meal would help most."
        }
      })
    ).toMatchObject({
      icon: "food",
      line: "My belly sent an official request for dinner."
    });
  });

  it("uses Korean home thought copy when the active locale is Korean", () => {
    expect(
      getHomeThoughtPresentation({
        petName: "Miso",
        reaction: idleReaction,
        satisfactionSummary: { hint: "Care rhythm is good." },
        daysAway: 2,
        locale: "ko-KR"
      })
    ).toMatchObject({
      line: "Miso가 돌아오길 기다렸어요. 다시 만나서 정말 좋아요!"
    });
  });

  it("uses Spanish home thought copy for a warm return greeting", () => {
    expect(
      getHomeThoughtPresentation({
        petName: "Miso",
        reaction: idleReaction,
        satisfactionSummary: { hint: "Care rhythm is good." },
        daysAway: 2,
        locale: "es-MX"
      })
    ).toMatchObject({
      line: "Miso te estuvo esperando. ¡Qué alegría tenerte de vuelta!"
    });
  });

  it("falls back to the selected authored reaction when no care need is active", () => {
    expect(
      getHomeThoughtPresentation({
        petName: "Miso",
        reaction: {
          ...idleReaction,
          category: "play_start",
          line: "Tiny play mode started."
        },
        satisfactionSummary: {
          hint: "Care rhythm is good."
        }
      })
    ).toMatchObject({
      icon: "heart",
      line: "evening light is sitting right beside me."
    });
  });

  it("prefers a supplied episode line over ambient reaction copy when preferEpisodeLine is true", () => {
    expect(
      getHomeThoughtPresentation({
        petName: "Miso",
        reaction: {
          ...idleReaction,
          category: "play_start",
          line: "Tiny play mode started."
        },
        satisfactionSummary: {
          hint: "Care rhythm is good."
        },
        episodeLine: { key: "habit:loves_playtime", line: "Is it playtime yet? Just asking.", source: "habit" },
        preferEpisodeLine: true
      })
    ).toMatchObject({
      icon: "heart",
      line: "Is it playtime yet? Just asking."
    });
  });

  it("ignores the episode line when preferEpisodeLine is false", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: {
        ...idleReaction,
        category: "play_start",
        line: "Tiny play mode started."
      },
      satisfactionSummary: {
        hint: "Care rhythm is good."
      },
      episodeLine: { key: "habit:loves_playtime", line: "Is it playtime yet? Just asking.", source: "habit" },
      preferEpisodeLine: false
    });

    expect(result.line).not.toBe("Is it playtime yet? Just asking.");
  });

  it("never lets an episode line override an urgent care need", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: idleReaction,
      satisfactionSummary: {
        primaryNeed: "food",
        hint: "A meal would help most."
      },
      episodeLine: { key: "habit:foodie", line: "I smelled something delicious. Probably.", source: "habit" },
      preferEpisodeLine: true
    });

    expect(result.line).toBe("My belly sent an official request for dinner.");
  });

  it("never lets an episode line override a return-after-days-away greeting", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: idleReaction,
      satisfactionSummary: { hint: "Care rhythm is good." },
      daysAway: 2,
      episodeLine: { key: "habit:foodie", line: "I smelled something delicious. Probably.", source: "habit" },
      preferEpisodeLine: true
    });

    expect(result.line).not.toBe("I smelled something delicious. Probably.");
  });

  it("lets a celebration reaction (priority >= 100) own the bubble outright, ignoring an active urgent need", () => {
    const celebration: SelectedReaction = {
      ruleId: "bond_level_up_3",
      category: "affection_high",
      line: "Our bond reached level 3! Thank you for all the little moments.",
      animation: "celebrate",
      priority: 100
    };

    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: celebration,
      satisfactionSummary: {
        primaryNeed: "food",
        hint: "A meal would help most."
      },
      recentAction: "feed"
    });

    expect(result.line).toBe("Our bond reached level 3! Thank you for all the little moments.");
  });

  it("lets a celebration reaction win even over a return-after-days-away greeting", () => {
    const celebration: SelectedReaction = {
      ruleId: "walk_collection_complete",
      category: "new_item",
      line: "Journal complete! Every little discovery we collected is here.",
      animation: "celebrate",
      priority: 100
    };

    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: celebration,
      satisfactionSummary: { hint: "Care rhythm is good." },
      daysAway: 3
    });

    expect(result.line).toBe("Journal complete! Every little discovery we collected is here.");
  });

  it("does not treat an ordinary-priority reaction as a celebration", () => {
    expect(isCelebrationReaction(idleReaction)).toBe(false);
    expect(isCelebrationReaction({ priority: 97 })).toBe(false);
    expect(isCelebrationReaction({ priority: 100 })).toBe(true);
    expect(isCelebrationReaction(null)).toBe(false);
  });

  it("shows the gentle night-care line and overrides an active urgent need, per the healing-app no-guilt tone", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: idleReaction,
      satisfactionSummary: {
        primaryNeed: "food",
        hint: "A meal would help most."
      },
      isShowingNightCareAcknowledgement: true
    });

    expect(result.line).toMatch(/thank you/i);
    expect(result.icon).toBe("heart");
  });

  it("still lets a celebration reaction win over the night-care line", () => {
    const celebration: SelectedReaction = {
      ruleId: "bond_level_up_3",
      category: "affection_high",
      line: "Our bond reached level 3! Thank you for all the little moments.",
      animation: "celebrate",
      priority: 100
    };

    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: celebration,
      satisfactionSummary: { hint: "Care rhythm is good." },
      isShowingNightCareAcknowledgement: true
    });

    expect(result.line).toBe("Our bond reached level 3! Thank you for all the little moments.");
  });

  it("lets a one-shot moment line (e.g. catching the butterfly visitor) own the bubble outright", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: idleReaction,
      satisfactionSummary: {
        primaryNeed: "food",
        hint: "A meal would help most."
      },
      isShowingNightCareAcknowledgement: true,
      momentOverrideLine: "Ooh, a little visitor!"
    });

    expect(result.line).toBe("Ooh, a little visitor!");
  });

  it("leaves the bubble untouched when no night-care or moment override is active", () => {
    const result = getHomeThoughtPresentation({
      petName: "Miso",
      reaction: idleReaction,
      satisfactionSummary: {
        primaryNeed: "food",
        hint: "A meal would help most."
      },
      isShowingNightCareAcknowledgement: false,
      momentOverrideLine: null
    });

    expect(result.line).toBe("My belly sent an official request for dinner.");
  });

  it("shows a startable path CTA when no walk is active", () => {
    expect(getHomeWalkCtaPresentation(null, "Miso", 0)).toMatchObject({
      status: "start",
      label: "Path",
      accessibilityLabel: "Start a tiny walk with Miso."
    });
  });

  it("shows walk progress instead of another start CTA while walking", () => {
    expect(getHomeWalkCtaPresentation(walking, "Miso", 12)).toMatchObject({
      status: "walking",
      label: "12s"
    });
  });

  it("returns to a startable path CTA when the walk has returned", () => {
    expect(getHomeWalkCtaPresentation({ ...walking, status: "returned" }, "Miso", 0)).toMatchObject({
      status: "start",
      label: "Path"
    });
  });

  it("does not show a reward notice after walks", () => {
    expect(
      getHomeWalkPanelVisibility({
        activeWalk: walking,
        hasClaimedWalkReward: false,
        rewardNoticeDismissed: false
      })
    ).toEqual({
      shouldShowClaimedWalkRewardNotice: false,
      showCareDock: true
    });

    expect(
      getHomeWalkPanelVisibility({
        activeWalk: null,
        hasClaimedWalkReward: true,
        rewardNoticeDismissed: false
      })
    ).toEqual({
      shouldShowClaimedWalkRewardNotice: false,
      showCareDock: true
    });

    expect(
      getHomeWalkPanelVisibility({
        activeWalk: null,
        hasClaimedWalkReward: true,
        rewardNoticeDismissed: true
      })
    ).toEqual({
      shouldShowClaimedWalkRewardNotice: false,
      showCareDock: true
    });
  });

  it("does not reopen stale claimed walk rewards from persisted session state", () => {
    expect(
      getHomeWalkPanelVisibility({
        activeWalk: { ...walking, status: "claimed" },
        hasClaimedWalkReward: true,
        rewardNoticeDismissed: false
      })
    ).toEqual({
      shouldShowClaimedWalkRewardNotice: false,
      showCareDock: true
    });
  });

  it("summarizes feed action meter and bond changes for immediate home feedback", () => {
    const occurredAt = "2026-06-24T10:00:00.000Z";
    const careResult = applyLocalCareAction(mockCareState, {
      action: "feed",
      occurredAt
    });
    const relationship = applyRelationshipCareAction(mockRelationshipState, "feed", occurredAt);

    expect(
      getHomeCareActionFeedbackPresentation({
        action: "feed",
        previousCareState: careResult.previousState,
        nextCareState: careResult.nextState,
        previousRelationshipState: mockRelationshipState,
        nextRelationshipState: relationship
      })
    ).toMatchObject({
      icon: "food",
      tone: "care",
      title: "Bowl filled",
      // Feed now gives a small energy recovery too ("eating gives you a
      // little energy back" -- see the mongchi "케어 체감 밸런스" fix), which
      // takes one of the 3 visible delta slots ahead of the bond delta.
      line: "Food +28 · Mood +8 · Energy +14"
    });
  });

  it("marks play as a cozy tradeoff when it spends energy or cleanliness", () => {
    const occurredAt = "2026-06-24T10:05:00.000Z";
    const careResult = applyLocalCareAction(mockCareState, {
      action: "play",
      occurredAt
    });
    const relationship = applyRelationshipCareAction(mockRelationshipState, "play", occurredAt);

    expect(
      getHomeCareActionFeedbackPresentation({
        action: "play",
        previousCareState: careResult.previousState,
        nextCareState: careResult.nextState,
        previousRelationshipState: mockRelationshipState,
        nextRelationshipState: relationship
      })
    ).toMatchObject({
      icon: "play",
      tone: "tradeoff",
      title: "Play time",
      line: "Mood +14 · Energy -8 · Clean -4"
    });
  });

  it("keeps water feedback in the pet-care loop without minting credits", () => {
    const occurredAt = "2026-06-24T10:10:00.000Z";
    const careResult = applyLocalCareAction(mockCareState, {
      action: "water_garden",
      occurredAt
    });
    const relationship = applyRelationshipCareAction(mockRelationshipState, "water_garden", occurredAt);

    expect(
      getHomeCareActionFeedbackPresentation({
        action: "water_garden",
        previousCareState: careResult.previousState,
        nextCareState: careResult.nextState,
        previousRelationshipState: mockRelationshipState,
        nextRelationshipState: relationship
      })
    ).toMatchObject({
      icon: "water",
      tone: "care",
      title: "Water served",
      // Water now gives gardenHealth +28 (was +24) and a small energy
      // recovery -- see the mongchi "케어 체감 밸런스" fix. Energy sits ahead
      // of Water in careDeltaFields order, so it takes the 3rd visible slot.
      line: "Mood +3 · Energy +14 · Water +28"
    });
  });

  it("tells the walk-start toast as a warm sentence instead of raw meter numbers", () => {
    const occurredAt = "2026-06-24T10:15:00.000Z";
    const careResult = applyLocalCareAction(mockCareState, {
      action: "walk",
      occurredAt
    });
    const relationship = applyRelationshipCareAction(mockRelationshipState, "walk", occurredAt);

    const presentation = getHomeCareActionFeedbackPresentation({
      action: "walk",
      previousCareState: careResult.previousState,
      nextCareState: careResult.nextState,
      previousRelationshipState: mockRelationshipState,
      nextRelationshipState: relationship
    });

    expect(presentation.line).toBe("Mong trotted off to the path.");
    expect(presentation.line).not.toMatch(/[+-]\d/);
    expect(presentation.accessibilityLabel).toBe("Path started. Mong trotted off to the path.");
  });

});

describe("terrarium home event toasts", () => {
  it("returns no streak toast when the streak is not yet started", () => {
    expect(getHomeStreakTogglePresentation(0)).toBeNull();
  });

  it("celebrates day one distinctly from a multi-day streak", () => {
    expect(getHomeStreakTogglePresentation(1)).toMatchObject({
      id: "streak-1",
      line: "Day 1 of your care streak! Off to a warm start."
    });

    expect(getHomeStreakTogglePresentation(5)).toMatchObject({
      id: "streak-5",
      line: "5 days in a row. This little garden loves the rhythm."
    });
  });

  it("localizes Korean care celebrations without changing stable toast ids", () => {
    expect(getHomeStreakTogglePresentation(5, "ko-KR")).toMatchObject({
      id: "streak-5",
      line: "5일 연속으로 함께했어요. 작은 정원이 이 리듬을 좋아해요."
    });
    expect(getWalkDiscoveryCardPresentation("햇살 꽃잎", "common", "ko-KR")).toMatchObject({
      id: "walk-discovery-햇살 꽃잎",
      line: "새 발견: 햇살 꽃잎"
    });
  });

  it("localizes Traditional Chinese streak and discovery output", () => {
    expect(getHomeStreakTogglePresentation(5, "zh-TW")).toMatchObject({
      id: "streak-5",
      line: "連續陪伴 5 天了。小花園很喜歡這個節奏。"
    });
    expect(getWalkDiscoveryCardPresentation("陽光花瓣", "common", "zh-TW")).toMatchObject({
      id: "walk-discovery-陽光花瓣",
      line: "新發現：陽光花瓣"
    });
  });

  it("selects localized walk collectible names", () => {
    const collectible = { id: "col_sunny_petal", nameEn: "Sunny Petal", nameKo: "햇살 꽃잎" };

    expect(getLocalizedWalkCollectibleName(collectible, "ja-JP")).toBe("ひだまりの花びら");
    expect(getLocalizedWalkCollectibleName(collectible, "es-MX")).toBe("Pétalo soleado");
    expect(getLocalizedWalkCollectibleName(collectible, "zh-TW")).toBe("陽光花瓣");
  });

  it("produces a one-shot toast id per buff so it never re-fires for the same grant", () => {
    const toast = getHomeBuffTogglePresentation({ buffId: "buff_favorite_toy", labelEn: "Favorite toy" });

    expect(toast).toEqual({
      id: "buff_favorite_toy",
      line: "Favorite toy is active!",
      accessibilityLabel: "Favorite toy effect just started."
    });
  });

  it("celebrates a bond level-up with a number-free line and no reward mention when the level has none", () => {
    // Level 1 has no bondLevelRewards entry.
    const toast = getBondLevelUpTogglePresentation(1);

    expect(toast).toEqual({
      id: "bond-level-1",
      line: "Lv 1 — we're getting closer.",
      accessibilityLabel: "Bond level up: level 1."
    });
  });

  it("mentions a reward warmly (no raw numbers) when the crossed level grants one", () => {
    // Level 2 grants freeChatTickets + an item, see bondRewards.ts.
    const toast = getBondLevelUpTogglePresentation(2);

    expect(toast.line).toBe("Lv 2 — we're getting closer. A little something extra landed in your things.");
    // The level number itself ("Lv 2") is fine per the task brief's own
    // example copy -- what must never leak is a raw reward quantity/amount.
    expect(toast.line).not.toMatch(/\d+\s*(credit|ticket|item|x\d)/i);
    expect(toast.id).toBe("bond-level-2");
  });

  it("keys the bond level toast persisted key per level", () => {
    expect(getBondLevelToastPersistedKey(3)).toBe("bond-level:3");
    expect(getBondLevelToastPersistedKey(2)).not.toBe(getBondLevelToastPersistedKey(3));
  });

  it("names a new walk discovery without exposing raw rarity odds", () => {
    const toast = getWalkDiscoveryCardPresentation("Sunny Petal", "common");

    expect(toast).toEqual({
      id: "walk-discovery-Sunny Petal",
      line: "New find: Sunny Petal",
      accessibilityLabel: "New find: Sunny Petal."
    });
  });

  it("gives a rare walk discovery a warmer accessibility label", () => {
    const toast = getWalkDiscoveryCardPresentation("Rainbow Shard", "rare");

    expect(toast.accessibilityLabel).toBe("New rare find: Rainbow Shard. This one is really special.");
  });

  it("celebrates walk-journal completion without a raw credit number", () => {
    const toast = getWalkCollectionCompleteTogglePresentation();

    expect(toast.id).toBe("walk-collection-complete");
    expect(toast.line).not.toMatch(/\d/);
    expect(toast.line).toContain("Walk journal complete");
  });
});

describe("days-together milestone toast", () => {
  const now = "2026-07-07T09:00:00.000Z";

  const milestoneMemory = (daysTogether: number, occurredAt: string): Pick<MemoryEntry, "type" | "occurredAt" | "refs"> => ({
    type: "days_milestone",
    occurredAt,
    refs: { daysTogether }
  });

  it("celebrates D7 with distinct copy when recorded today", () => {
    const toast = getDaysMilestoneTogglePresentation(milestoneMemory(7, now), "Momo", now);

    expect(toast).toMatchObject({ id: "days-milestone-7", line: "A whole week together." });
  });

  it("celebrates D14 with distinct copy when recorded today", () => {
    const toast = getDaysMilestoneTogglePresentation(milestoneMemory(14, now), "Momo", now);

    expect(toast).toMatchObject({ id: "days-milestone-14", line: "Two weeks of little hellos." });
  });

  it("celebrates D30 with distinct copy that points to the letter, interpolating the pet's name", () => {
    const toast = getDaysMilestoneTogglePresentation(milestoneMemory(30, now), "Momo", now);

    expect(toast).toMatchObject({ id: "days-milestone-30", line: "One month. Momo left you a letter." });
  });

  it("does not fire when the milestone was recorded on an earlier day", () => {
    const toast = getDaysMilestoneTogglePresentation(milestoneMemory(7, "2026-07-01T09:00:00.000Z"), "Momo", now);

    expect(toast).toBeNull();
  });

  it("returns null for a non-days_milestone memory", () => {
    const toast = getDaysMilestoneTogglePresentation({ type: "bond_level", occurredAt: now, refs: {} }, "Momo", now);

    expect(toast).toBeNull();
  });

  it("returns null for a milestone count this feature has no copy for", () => {
    const toast = getDaysMilestoneTogglePresentation(milestoneMemory(21, now), "Momo", now);

    expect(toast).toBeNull();
  });

  it("keys the persisted toast by milestone count, distinct per milestone", () => {
    expect(getDaysMilestoneToastPersistedKey(7)).toBe("days-milestone:7");
    expect(getDaysMilestoneToastPersistedKey(14)).not.toBe(getDaysMilestoneToastPersistedKey(7));
    expect(getDaysMilestoneToastPersistedKey(30)).not.toBe(getDaysMilestoneToastPersistedKey(14));
  });
});

describe("friend entry badge visibility", () => {
  it("is hidden before day 30", () => {
    expect(getFriendEntryBadgeVisible(29, false)).toBe(false);
  });

  it("is visible at day 30+ while the monthly letter is unopened", () => {
    expect(getFriendEntryBadgeVisible(30, false)).toBe(true);
    expect(getFriendEntryBadgeVisible(45, false)).toBe(true);
  });

  it("is hidden once the monthly letter has been opened", () => {
    expect(getFriendEntryBadgeVisible(30, true)).toBe(false);
  });
});

describe("HUD gauge guide popup", () => {
  it("describes the fullness gauge without exposing raw numbers in guilt-tripping language, leading with the feed action", () => {
    const guide = getHudMeterGuidePresentation("fullness", 12);

    expect(guide.title).toBe("Full");
    expect(guide.howTo).toBe("A good meal fills this right up.");
    expect(guide.actionIcons).toEqual(["food"]);
    expect(guide.statusLine).toBe("Feeling quite empty — a meal would go a long way.");
    expect(guide.statusLine).not.toMatch(/danger|warning|!|\d/);
  });

  it("frames the thirst gauge as the dog's water bowl, not a garden, leading with the water action", () => {
    const guide = getHudMeterGuidePresentation("thirst", 12);

    expect(guide.title).toBe("Water");
    expect(guide.description).toBe("Fresh water keeps your buddy happily hydrated.");
    expect(guide.howTo).toBe("A fresh bowl of water tops this right off.");
    expect(guide.actionIcons).toEqual(["water"]);
    expect(guide.statusLine).not.toMatch(/garden|soil|leaves|leaf/i);
    expect(guide.description).not.toMatch(/garden|soil|leaves|leaf/i);
    expect(guide.howTo).not.toMatch(/garden|soil|leaves|leaf/i);
  });

  it("localizes the gauge guide for Korean", () => {
    expect(getHudMeterGuidePresentation("thirst", 12, "ko-KR")).toMatchObject({
      title: "물",
      description: "신선한 물은 우리 친구의 몸과 기분을 촉촉하게 해줘요.",
      howTo: "깨끗한 물 한 그릇을 채워주세요.",
      statusLine: "목이 많이 말라 보여요. 신선한 물이 큰 도움이 될 거예요."
    });
  });

  it("localizes the thirst gauge guide for Japanese", () => {
    expect(getHudMeterGuidePresentation("thirst", 12, "ja-JP")).toMatchObject({
      title: "お水",
      description: "新鮮なお水で、いきいき心地よく過ごせます。",
      howTo: "新鮮なお水を一杯あげると、すぐに潤います。",
      statusLine: "喉がかなり渇いているみたい。新鮮なお水がうれしいはずです。"
    });
  });

  it("points the mood gauge at play and petting, and the energy gauge at rest and feeding", () => {
    const mood = getHudMeterGuidePresentation("mood", 40);
    const energy = getHudMeterGuidePresentation("energy", 40);

    expect(mood.actionIcons).toEqual(["play", "heart"]);
    expect(energy.actionIcons).toEqual(["rest", "food"]);
  });

  it("points the cleanliness gauge at the Bath action, with a number-free, no-guilt how-to line", () => {
    const guide = getHudMeterGuidePresentation("cleanliness", 12);

    expect(guide.title).toBe("Clean");
    expect(guide.howTo).toBe("A warm bath freshens this right up.");
    expect(guide.actionIcons).toEqual(["clean"]);
    expect(guide.statusLine).toBe("Feeling pretty grubby — a bath would feel really nice.");
    expect(guide.statusLine).not.toMatch(/danger|warning|!|\d/);
  });

  it("celebrates a fully clean pet and never shames a dirty one, across every cleanliness band", () => {
    expect(getHudMeterGuidePresentation("cleanliness", 90).statusLine).toBe("So fresh and clean!");
    expect(getHudMeterGuidePresentation("cleanliness", 60).statusLine).toBe("Comfortably clean for now.");
    expect(getHudMeterGuidePresentation("cleanliness", 30).statusLine).toBe("Getting a little dusty over here.");
    expect(getHudMeterGuidePresentation("cleanliness", 5).statusLine).not.toMatch(/dirty|filthy|gross|bad/i);
  });

  it("gives warm, non-alarming copy across every band for each gauge, and leads the accessibility label with the action guidance", () => {
    const keys = ["fullness", "thirst", "mood", "energy", "cleanliness"] as const;
    const values = [5, 30, 60, 90];

    for (const key of keys) {
      for (const value of values) {
        const guide = getHudMeterGuidePresentation(key, value);

        expect(guide.statusLine.length).toBeGreaterThan(0);
        expect(guide.actionIcons.length).toBeGreaterThan(0);
        expect(guide.accessibilityLabel).toContain(guide.title);
        expect(guide.accessibilityLabel).toContain(guide.howTo);
        expect(guide.accessibilityLabel.indexOf(guide.howTo)).toBeLessThan(guide.accessibilityLabel.indexOf(guide.statusLine));
      }
    }
  });
});

describe("getAmbientReactionSeed", () => {
  const weather = { condition: "clear" as const, intensity: "normal" as const };

  it("returns the same seed for renders a second apart within the same 5-minute window", () => {
    const first = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:01.000Z", weather);

    expect(second).toBe(first);
  });

  it("changes the seed once the 5-minute window elapses", () => {
    const first = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:06:00.000Z", weather);

    expect(second).not.toBe(first);
  });

  it("does not change the seed for a tiny stat wobble that stays in the same care band", () => {
    const first = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed(
      "pet_miso_001",
      { ...mockCareState, satiety: mockCareState.satiety - 1 },
      "2026-06-24T09:00:00.000Z",
      weather
    );

    expect(second).toBe(first);
  });

  it("changes the seed when a stat crosses into a different care band", () => {
    const first = getAmbientReactionSeed("pet_miso_001", { ...mockCareState, satiety: 80 }, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed("pet_miso_001", { ...mockCareState, satiety: 10 }, "2026-06-24T09:00:00.000Z", weather);

    expect(second).not.toBe(first);
  });

  it("changes the seed when the weather condition changes", () => {
    const first = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", {
      condition: "rain",
      intensity: "normal"
    });

    expect(second).not.toBe(first);
  });

  it("changes the seed for a different pet", () => {
    const first = getAmbientReactionSeed("pet_miso_001", mockCareState, "2026-06-24T09:00:00.000Z", weather);
    const second = getAmbientReactionSeed("pet_other_002", mockCareState, "2026-06-24T09:00:00.000Z", weather);

    expect(second).not.toBe(first);
  });
});

describe("home event toast persisted keys", () => {
  it("keys the streak toast by day so a restart on the same day does not replay it", () => {
    expect(getStreakToastPersistedKey("2026-06-24")).toBe("streak:2026-06-24");
    expect(getStreakToastPersistedKey("2026-06-24")).toBe(getStreakToastPersistedKey("2026-06-24"));
    expect(getStreakToastPersistedKey("2026-06-25")).not.toBe(getStreakToastPersistedKey("2026-06-24"));
  });

  it("keys the buff toast by buff + grant instance so a re-grant later still gets its own toast", () => {
    const firstGrant = getBuffToastPersistedKey("buff_full_belly", "2026-06-24T09:00:00.000Z");
    const sameGrantAgain = getBuffToastPersistedKey("buff_full_belly", "2026-06-24T09:00:00.000Z");
    const secondGrant = getBuffToastPersistedKey("buff_full_belly", "2026-06-24T15:00:00.000Z");
    const differentBuffSameInstant = getBuffToastPersistedKey("buff_cozy_nap", "2026-06-24T09:00:00.000Z");

    expect(firstGrant).toBe("buff:buff_full_belly:2026-06-24T09:00:00.000Z");
    expect(sameGrantAgain).toBe(firstGrant);
    expect(secondGrant).not.toBe(firstGrant);
    expect(differentBuffSameInstant).not.toBe(firstGrant);
  });

  it("keeps the key list unchanged once under the cap", () => {
    const keys = ["a", "b", "c"];

    expect(pruneEventToastPersistedKeys(keys, 50)).toEqual(["a", "b", "c"]);
  });

  it("drops the oldest keys once the cap is exceeded, keeping the most recent", () => {
    const keys = Array.from({ length: 60 }, (_, index) => `key-${index}`);

    const pruned = pruneEventToastPersistedKeys(keys, 50);

    expect(pruned).toHaveLength(50);
    expect(pruned[0]).toBe("key-10");
    expect(pruned[pruned.length - 1]).toBe("key-59");
  });

  it("defaults to a 50-key cap when no limit is given", () => {
    const keys = Array.from({ length: 80 }, (_, index) => `key-${index}`);

    expect(pruneEventToastPersistedKeys(keys)).toHaveLength(50);
  });

  it("never mutates the input array", () => {
    const keys = ["a", "b", "c"];

    pruneEventToastPersistedKeys(keys, 2);

    expect(keys).toEqual(["a", "b", "c"]);
  });
});
