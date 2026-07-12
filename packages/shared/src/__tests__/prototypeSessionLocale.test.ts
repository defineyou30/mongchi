import { describe, expect, it } from "vitest";

import {
  acceptPrototypeGeneratedPet,
  claimPrototypeWalkReward,
  createInitialPrototypeSession,
  getActivePetBundle,
  performPrototypeCareAction,
  refreshPrototypeWalk,
  startPrototypeWalk,
  updatePrototypeDraft
} from "../session/prototypeSession";

const NOW = "2026-06-24T09:00:00.000Z";

const createAcceptedPet = () =>
  acceptPrototypeGeneratedPet(
    updatePrototypeDraft(createInitialPrototypeSession(NOW), { name: "Miso" }),
    NOW,
    { locale: "ja-JP" }
  );

describe("prototype session locale", () => {
  it("stores a Japanese care reaction when the active app locale is Japanese", () => {
    const state = performPrototypeCareAction(
      createAcceptedPet(),
      "feed",
      "2026-06-24T09:01:00.000Z",
      undefined,
      { locale: "ja-JP" }
    );

    expect(getActivePetBundle(state).currentReaction?.line).toMatch(/[ぁ-んァ-ン一-龯]/u);
  });

  it("stores a Traditional Chinese discovery reaction after a walk claim", () => {
    const walking = startPrototypeWalk(createAcceptedPet(), "2026-06-24T09:01:00.000Z", 1_000, undefined, "zh-TW");
    const returned = refreshPrototypeWalk(walking, "2026-06-24T09:01:01.000Z", "zh-TW");
    const claimed = claimPrototypeWalkReward(returned, "2026-06-24T09:01:02.000Z", "zh-TW");

    expect(getActivePetBundle(claimed).currentReaction?.line).toMatch(/[一-鿿]/u);
  });
});
