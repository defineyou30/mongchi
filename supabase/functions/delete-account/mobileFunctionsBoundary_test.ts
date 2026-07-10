import { assertEquals } from "jsr:@std/assert@1";
import { FunctionsClient } from "npm:@supabase/functions-js@2.109.0";

import { deleteSupabaseAccountData } from "../../../apps/mobile/src/features/session/supabaseAccountDeletion.ts";

class UnexpectedServerAddressError extends Error {
  override readonly name = "UnexpectedServerAddressError";
}

Deno.test("official FunctionsClient 401 is typed and releases its response body", async () => {
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, onListen: () => undefined },
    () =>
      new Response(JSON.stringify({ ok: false, error: { code: "unauthorized", retryable: false } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
  );
  const address = server.addr;

  if (address.transport !== "tcp") {
    await server.shutdown();
    await server.finished;
    throw new UnexpectedServerAddressError("HTTP fixture did not bind a TCP address");
  }

  const functions = new FunctionsClient(`http://127.0.0.1:${address.port}`, {
    headers: { Authorization: "Bearer local-fixture-token" }
  });

  try {
    // Given the official Functions client receives an unauthorized response with a JSON body.
    const result = await deleteSupabaseAccountData({ functions });

    // When the mobile boundary returns, Then it preserves the typed result and owns no live body resource.
    assertEquals(result, {
      ok: false,
      reason: "unauthorized",
      retryable: false,
      code: "unauthorized",
      status: 401
    });
  } finally {
    await server.shutdown();
    await server.finished;
  }
});
