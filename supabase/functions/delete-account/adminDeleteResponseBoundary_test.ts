import { assertEquals } from "jsr:@std/assert@1";

type EdgeHandler = (request: Request) => Response | Promise<Response>;

const USER_ID = "00000000-0000-4000-8000-000000000001" as const;

class FixtureSetupError extends Error {
  override readonly name = "FixtureSetupError";
}

const originalServeDescriptor = Object.getOwnPropertyDescriptor(Deno, "serve");
let capturedHandler: EdgeHandler | undefined;

Object.defineProperty(Deno, "serve", {
  configurable: true,
  value: (handler: EdgeHandler): void => {
    capturedHandler = handler;
  }
});

await import(`./index.ts?admin-delete-response=${crypto.randomUUID()}`);

if (originalServeDescriptor === undefined) {
  throw new FixtureSetupError("Deno.serve descriptor is unavailable");
}

Object.defineProperty(Deno, "serve", originalServeDescriptor);

if (capturedHandler === undefined) {
  throw new FixtureSetupError("delete-account handler was not captured");
}

const handleRequest = capturedHandler;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

Deno.test("delete-account releases official auth-js admin 503 JSON response while retaining retryable failure", async () => {
  let authDeleteCalls = 0;
  const upstream = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => undefined },
    (request) => {
      const url = new URL(request.url);

      if (url.pathname === "/auth/v1/user" && request.method === "GET") {
        return jsonResponse({
          id: USER_ID,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {}
        });
      }

      if (url.pathname.startsWith("/rest/v1/") && request.method === "HEAD") {
        return new Response(null, { status: 200, headers: { "Content-Range": "*/0" } });
      }

      if (url.pathname === "/storage/v1/object/list/pet-media" && request.method === "POST") {
        return jsonResponse([]);
      }

      if (url.pathname === `/auth/v1/admin/users/${USER_ID}` && request.method === "DELETE") {
        authDeleteCalls += 1;
        return jsonResponse({ message: "fixture admin unavailable" }, 503);
      }

      return jsonResponse({ message: "unexpected fixture request" }, 500);
    }
  );

  if (upstream.addr.transport !== "tcp") {
    await upstream.shutdown();
    await upstream.finished;
    throw new FixtureSetupError("fixture did not bind TCP");
  }

  const originalUrl = Deno.env.get("SUPABASE_URL");
  const originalServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const origin = `http://127.0.0.1:${upstream.addr.port}`;
  Deno.env.set("SUPABASE_URL", origin);
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service-role");

  try {
    const response = await handleRequest(
      new Request("http://edge.test/delete-account", {
        method: "POST",
        headers: { Authorization: "Bearer fixture-user-token", "Content-Type": "application/json" },
        body: "{}"
      })
    );

    assertEquals(authDeleteCalls, 1);
    assertEquals(response.status, 503);
    assertEquals(await response.json(), {
      ok: false,
      error: { code: "auth_delete_failed", retryable: true }
    });
  } finally {
    if (originalUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalUrl);

    if (originalServiceKey === undefined) Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalServiceKey);

    await upstream.shutdown();
    await upstream.finished;
  }
});
