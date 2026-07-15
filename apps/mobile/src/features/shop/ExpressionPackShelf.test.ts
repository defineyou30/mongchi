import { describe, expect, it } from "vitest";

import { getExpressionPackShelfAction } from "./expressionPackShelfAction";

describe("getExpressionPackShelfAction", () => {
  it("opens the credit store when a failed pack cannot afford a retry", () => {
    expect(getExpressionPackShelfAction({ status: "failed", canAct: false })).toBe("credits");
  });

  it("retries a failed pack when the wallet can afford it", () => {
    expect(getExpressionPackShelfAction({ status: "failed", canAct: true })).toBe("unlock");
  });

  it("keeps owned and in-progress packs disabled", () => {
    expect(getExpressionPackShelfAction({ status: "owned", canAct: false })).toBe("disabled");
    expect(getExpressionPackShelfAction({ status: "generating", canAct: false })).toBe("disabled");
    expect(getExpressionPackShelfAction({ status: "purchasing", canAct: false })).toBe("disabled");
  });
});
