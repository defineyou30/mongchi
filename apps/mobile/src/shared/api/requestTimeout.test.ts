import { describe, expect, it } from "vitest";

import { RequestTimeoutError, withRequestTimeout } from "./requestTimeout";

describe("withRequestTimeout", () => {
  it("returns a settled request before its deadline", async () => {
    await expect(withRequestTimeout(Promise.resolve("ready"), 20)).resolves.toBe("ready");
  });

  it("rejects a request that exceeds its deadline", async () => {
    const pending = new Promise<never>(() => undefined);

    await expect(withRequestTimeout(pending, 5)).rejects.toBeInstanceOf(RequestTimeoutError);
  });
});
