import { describe, expect, it } from "vitest";

import { createExpressionPackPurchaseCoordinator } from "./expressionPackPurchaseCoordinator";

describe("createExpressionPackPurchaseCoordinator", () => {
  it("reuses one request id after an ambiguous start failure", () => {
    const coordinator = createExpressionPackPurchaseCoordinator(() => "request-1");

    const first = coordinator.begin("pack-a");
    expect(first).toEqual({ ok: true, requestId: "request-1" });

    coordinator.finish("pack-a", "retryable_failure");

    expect(coordinator.begin("pack-a")).toEqual({ ok: true, requestId: "request-1" });
  });

  it("creates a new request id after a definitive failure", () => {
    const ids = ["request-1", "request-2"];
    const coordinator = createExpressionPackPurchaseCoordinator(() => ids.shift() ?? "unexpected");

    expect(coordinator.begin("pack-a")).toEqual({ ok: true, requestId: "request-1" });
    coordinator.finish("pack-a", "definitive_failure");

    expect(coordinator.begin("pack-a")).toEqual({ ok: true, requestId: "request-2" });
  });

  it("blocks a second pack while the first start request is unresolved", () => {
    const coordinator = createExpressionPackPurchaseCoordinator(() => "request-1");

    expect(coordinator.begin("pack-a")).toEqual({ ok: true, requestId: "request-1" });
    expect(coordinator.begin("pack-b")).toEqual({ ok: false, reason: "start_in_flight" });
  });

  it("uses a request id restored from durable storage", () => {
    const coordinator = createExpressionPackPurchaseCoordinator(() => "new-request");

    expect(coordinator.begin("pack-a", "persisted-request")).toEqual({ ok: true, requestId: "persisted-request" });
  });
});
