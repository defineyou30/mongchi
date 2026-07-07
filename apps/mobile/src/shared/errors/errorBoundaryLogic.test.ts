import { describe, expect, it } from "vitest";

import { clearedErrorBoundaryState, deriveErrorBoundaryState, initialErrorBoundaryState } from "./errorBoundaryLogic";

describe("errorBoundaryLogic", () => {
  describe("initialErrorBoundaryState", () => {
    it("starts with no error", () => {
      expect(initialErrorBoundaryState).toEqual({ error: null });
    });
  });

  describe("deriveErrorBoundaryState", () => {
    it("wraps the caught error in state shape", () => {
      const error = new Error("render boom");
      expect(deriveErrorBoundaryState(error)).toEqual({ error });
    });

    it("preserves distinct error instances across calls", () => {
      const first = new Error("first");
      const second = new Error("second");

      expect(deriveErrorBoundaryState(first).error).toBe(first);
      expect(deriveErrorBoundaryState(second).error).toBe(second);
    });
  });

  describe("clearedErrorBoundaryState", () => {
    it("resets to no error, for use by the retry handler", () => {
      expect(clearedErrorBoundaryState).toEqual({ error: null });
    });
  });
});
