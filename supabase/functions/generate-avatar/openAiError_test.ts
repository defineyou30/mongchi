import { assertEquals } from "jsr:@std/assert@1";

import { readOpenAiErrorDetail } from "./openAiError.ts";

Deno.test("readOpenAiErrorDetail extracts the provider message without retaining the response envelope", async () => {
  const response = new Response(
    JSON.stringify({
      error: {
        message: "Unsupported value for input_fidelity.",
        type: "invalid_request_error",
      },
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );

  assertEquals(
    await readOpenAiErrorDetail(response),
    "Unsupported value for input_fidelity.",
  );
});

Deno.test("readOpenAiErrorDetail truncates unstructured provider responses", async () => {
  const response = new Response(`  ${"x".repeat(500)}  `, { status: 500 });

  assertEquals((await readOpenAiErrorDetail(response)).length, 300);
});
