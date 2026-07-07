import { describe, expect, it } from "vitest";

import { mockEntitlements, mockItems } from "@mongchi/shared";

import { getRuntimeActiveEntitlements, getRuntimeCatalogItems } from "./runtimePresentationData";

describe("runtime presentation data", () => {
  it("uses local mock catalog and entitlements only in local mode", () => {
    expect(getRuntimeCatalogItems("local", null)).toEqual(mockItems);
    expect(getRuntimeActiveEntitlements("local", null)).toEqual(
      mockEntitlements.filter((entitlement) => entitlement.status === "active")
    );
  });

  it("does not fall back to mock catalog or entitlements in API-backed mode", () => {
    expect(getRuntimeCatalogItems("api", null)).toEqual([]);
    expect(getRuntimeActiveEntitlements("api", null)).toEqual([]);
  });

  it("uses server-owned catalog and active entitlements in API-backed mode", () => {
    const active = {
      ...mockEntitlements[0]!,
      id: "ent_api_active",
      key: "premium_chat" as const
    };
    const revoked = {
      ...active,
      id: "ent_api_revoked",
      status: "revoked" as const
    };

    expect(getRuntimeCatalogItems("api", [mockItems[0]!])).toEqual([mockItems[0]]);
    expect(getRuntimeActiveEntitlements("api", [active, revoked])).toEqual([active]);
  });
});
