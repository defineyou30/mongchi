import { describe, expectTypeOf, it } from "vitest";

import type { ComponentType } from "react";

import type { ActionButtonProps } from "../../shared/ui/ActionButton";

type LegacyIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
type BothIconModes = Extract<ActionButtonProps, { Icon: LegacyIcon; iconId: "paw" }>;
type NoIconMode = Extract<ActionButtonProps, { Icon?: undefined; iconId?: undefined }>;

describe("Welcome and Settings custom icon contract", () => {
  it("accepts either legacy Icon or iconId, but never both", () => {
    expectTypeOf<BothIconModes>().toEqualTypeOf<never>();
    expectTypeOf<NoIconMode>().not.toEqualTypeOf<never>();
  });
});
