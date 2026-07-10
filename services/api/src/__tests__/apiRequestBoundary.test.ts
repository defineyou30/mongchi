import type { Server } from "node:http";

import { describe, expect, it } from "vitest";

import { apiEndpoints } from "../contracts";
import { createApiHttpRouter } from "../httpRouter";
import { createApiNodeServer } from "../nodeServer";
import type { ApiNodeServerOptions } from "../nodeServer";

const authenticatedHeaders = {
  authorization: "Bearer user_demo_001",
  "content-type": "application/json"
};

const startServer = async (options: ApiNodeServerOptions = {}) => {
  const api = createApiNodeServer(options);
  const port = await new Promise<number>((resolve, reject) => {
    api.server.once("error", reject);
    api.server.listen(0, "127.0.0.1", () => {
      const address = api.server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Expected an ephemeral TCP port."));
        return;
      }

      resolve(address.port);
    });
  });

  return {
    ...api,
    baseUrl: `http://127.0.0.1:${port}`
  };
};

const stopServer = async (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.closeAllConnections?.();
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const expectBoundaryError = (response: { status: number; body: unknown }, status: number, code: string): void => {
  expect(response).toMatchObject({
    status,
    body: {
      error: {
        status,
        code
      }
    }
  });
};

describe("API mutation request boundary", () => {
  it.each([
    ["null", null],
    ["array", []],
    ["malformed object", { name: 42 }]
  ])("Given a %s pet body, when it is parsed, then a typed 422 is returned", (_label, body) => {
    // Given
    const router = createApiHttpRouter();

    // When
    const response = router.handle({
      method: "POST",
      path: "/v1/pets",
      headers: authenticatedHeaders,
      body
    });

    // Then
    expectBoundaryError(response, 422, "invalid_request_body");
  });

  it("Given every mutation route, when a null body is supplied, then no route bypasses boundary parsing", async () => {
    // Given
    const router = createApiHttpRouter();
    const cases = apiEndpoints
      .filter((endpoint) => endpoint.method !== "GET")
      .map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path.replace(/:[^/]+/gu, "boundary_test_id")
      }));

    // When
    const responses = await Promise.all(
      cases.map((testCase) =>
        router.handleAsync({
          method: testCase.method,
          path: testCase.path,
          headers: authenticatedHeaders,
          body: null
        })
      )
    );

    // Then
    expect(cases).toHaveLength(27);
    for (const response of responses) {
      expectBoundaryError(response, 422, "invalid_request_body");
    }
  });

  it("Given malformed percent encoding, when the path is parsed, then a safe 400 is returned", () => {
    // Given
    const router = createApiHttpRouter();

    // When
    const response = router.handle({
      method: "GET",
      path: "/v1/pets/%ZZ",
      headers: authenticatedHeaders
    });

    // Then
    expectBoundaryError(response, 400, "invalid_request_path");
  });

  it("Given invalid bodies and paths over live HTTP, when requests repeat, then each request terminates safely", async () => {
    // Given
    const api = await startServer();

    try {
      // When
      const requests = [
        fetch(`${api.baseUrl}/v1/pets`, {
          method: "POST",
          headers: authenticatedHeaders,
          body: "null",
          signal: AbortSignal.timeout(1_000)
        }),
        fetch(`${api.baseUrl}/v1/pets`, {
          method: "POST",
          headers: authenticatedHeaders,
          body: "[]",
          signal: AbortSignal.timeout(1_000)
        }),
        fetch(`${api.baseUrl}/v1/pets/%ZZ`, {
          headers: authenticatedHeaders,
          signal: AbortSignal.timeout(1_000)
        })
      ];
      const responses = await Promise.all(requests);

      // Then
      expect(responses.map((response) => response.status)).toEqual([422, 422, 400]);
      await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
        expect.objectContaining({ error: expect.objectContaining({ code: "invalid_request_body" }) }),
        expect.objectContaining({ error: expect.objectContaining({ code: "invalid_request_body" }) }),
        expect.objectContaining({ error: expect.objectContaining({ code: "invalid_request_path" }) })
      ]);
    } finally {
      await stopServer(api.server);
    }
  });

  it("Given a rejected async dependency, when live HTTP handles it, then a safe 500 terminates without leaking details", async () => {
    // Given
    const api = await startServer({
      sessionVerifier: {
        verifySession: async () => {
          throw new Error("raw auth provider secret");
        }
      }
    });

    try {
      // When
      const response = await fetch(`${api.baseUrl}/v1/me`, {
        headers: authenticatedHeaders,
        signal: AbortSignal.timeout(1_000)
      });
      const bodyText = await response.text();

      // Then
      expect(response.status).toBe(500);
      expect(bodyText).toContain("internal_server_error");
      expect(bodyText).not.toContain("raw auth provider secret");
    } finally {
      await stopServer(api.server);
    }
  });
});
