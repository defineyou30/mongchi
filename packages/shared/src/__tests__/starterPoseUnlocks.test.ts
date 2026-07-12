import { describe, expect, it } from "vitest";

import { getStarterPoseUnlockStatesForCareAction } from "../domain/starterPoseUnlocks";

describe("getStarterPoseUnlockStatesForCareAction", () => {
  it("reveals happy after the first basic care action", () => {
    expect(getStarterPoseUnlockStatesForCareAction("feed", ["idle"])).toEqual(["happy"]);
  });

  it("reveals happy and sleep together when the first action is rest", () => {
    expect(getStarterPoseUnlockStatesForCareAction("rest", ["idle"])).toEqual(["happy", "sleep"]);
  });

  it("reveals only sleep when happy was earned earlier", () => {
    expect(getStarterPoseUnlockStatesForCareAction("rest", ["idle", "happy"])).toEqual(["sleep"]);
  });

  it("is idempotent once both rewards are owned", () => {
    expect(getStarterPoseUnlockStatesForCareAction("rest", ["idle", "happy", "sleep"])).toEqual([]);
  });
});
