// Unit tests for moderation.ts's pure input/output moderation functions.
//
// These exercise moderatePremiumChatInput/moderatePremiumChatProviderReply
// directly with no npm/HTTP/Deno.serve dependency, matching the
// chromakey_test.ts / deletionPlan_test.ts precedent for this project's Edge
// Functions. Run with: deno test moderation_test.ts
//
// Coverage intent (docs/chat-live-design.md §5.2/§5.4): the narrow crisis
// pattern must route to a no-charge, no-LLM crisis referral (layer 1) rather
// than a hard reject; the crisis copy must be locale-aware and carry the
// P15-mandated 988/findahelpline.com resources; ordinary hard-day venting
// must NOT trip the crisis path (over-trigger guard); the output backstop
// (layer 2) must still catch crisis content that slips through the provider
// and swap in the same DRAFT copy; professionalAdvicePattern keeps its
// existing 422 behavior on input, unchanged from services/api.

import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { crisisResourceText, moderatePremiumChatInput, moderatePremiumChatProviderReply } from "./moderation.ts";

// ---------------------------------------------------------------------------
// moderatePremiumChatInput
// ---------------------------------------------------------------------------

Deno.test("moderatePremiumChatInput: empty message is rejected with 422", () => {
  const result = moderatePremiumChatInput("   ", "en");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assertEquals(result.code, "empty_message");
  }
});

Deno.test("moderatePremiumChatInput: over-length message is rejected with 422", () => {
  const result = moderatePremiumChatInput("a".repeat(501), "en");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assertEquals(result.code, "message_too_long");
  }
});

Deno.test("moderatePremiumChatInput: self-harm pattern returns a crisis referral, not a 422", () => {
  const result = moderatePremiumChatInput("I want to kill myself", "en");
  assert(result.ok, "crisis referral must be ok:true, never a hard reject (P15)");
  if (result.ok) {
    assert(result.crisisReferral);
    if (result.crisisReferral) {
      assertEquals(result.safetyFlags, ["crisis_referral"]);
      assert(result.replyText.includes("988"), "US 988 Lifeline must be present (P15 minimum)");
      assert(result.replyText.includes("findahelpline.com"), "international resource must be present (P15 minimum)");
    }
  }
});

Deno.test("moderatePremiumChatInput: crisis referral copy is locale-aware", () => {
  // The detection pattern itself is English-only today (ported verbatim from
  // services/api -- regional/language expansion needs verified resources +
  // expert review first, see docs/chat-live-design.md §5.4), so this checks
  // that the *reply copy* still branches on the caller's locale even when the
  // triggering phrase is in English.
  const en = moderatePremiumChatInput("I want to kill myself", "en-US");
  const ko = moderatePremiumChatInput("I want to kill myself", "ko-KR");

  assert(en.ok && en.crisisReferral);
  assert(ko.ok && ko.crisisReferral);

  if (en.ok && en.crisisReferral && ko.ok && ko.crisisReferral) {
    assert(en.replyText.startsWith("I'm really glad"));
    assert(ko.replyText.startsWith("말해줘서"));
    assert(ko.replyText.includes("findahelpline.com"));
  }
});

Deno.test("moderatePremiumChatInput: crisisResourceText matches the moderation output exactly (single source of copy)", () => {
  const result = moderatePremiumChatInput("I want to end my life", "en");
  assert(result.ok && result.crisisReferral);
  if (result.ok && result.crisisReferral) {
    assertEquals(result.replyText, crisisResourceText("en"));
  }
});

Deno.test("moderatePremiumChatInput: ordinary hard-day venting is NOT treated as a crisis (over-trigger guard)", () => {
  const result = moderatePremiumChatInput("Today was really rough and I feel exhausted.", "en");
  assert(result.ok);
  if (result.ok) {
    assertFalse(result.crisisReferral);
  }
});

Deno.test("moderatePremiumChatInput: professional-advice pattern still returns a 422 (unchanged)", () => {
  const result = moderatePremiumChatInput("Can you diagnose what's wrong with me?", "en");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 422);
    assertEquals(result.code, "safety_professional_advice");
  }
});

Deno.test("moderatePremiumChatInput: an ordinary message passes through normalized with no flags", () => {
  const result = moderatePremiumChatInput("  Hi   there,  how are you?  ", "en");
  assert(result.ok);
  if (result.ok) {
    assertFalse(result.crisisReferral);
    if (!result.crisisReferral) {
      assertEquals(result.normalizedText, "Hi there, how are you?");
      assertEquals(result.safetyFlags, []);
    }
  }
});

// ---------------------------------------------------------------------------
// moderatePremiumChatProviderReply
// ---------------------------------------------------------------------------

Deno.test("moderatePremiumChatProviderReply: empty text is unavailable (503)", () => {
  const result = moderatePremiumChatProviderReply({ text: "   ", safetyFlags: [] }, "en");
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.status, 503);
    assertEquals(result.code, "premium_chat_output_unavailable");
  }
});

Deno.test("moderatePremiumChatProviderReply: over-length text is unavailable (503)", () => {
  const result = moderatePremiumChatProviderReply({ text: "a".repeat(300), safetyFlags: [] }, "en");
  assertEquals(result.ok, false);
});

Deno.test("moderatePremiumChatProviderReply: crisis content in the reply is replaced with the DRAFT crisis copy", () => {
  const result = moderatePremiumChatProviderReply({ text: "You should just kill myself", safetyFlags: [] }, "en");
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.moderated, true);
    assertEquals(result.text, crisisResourceText("en"));
    assert(result.safetyFlags.includes("crisis_escalation"));
    assert(result.safetyFlags.includes("provider_output_moderated"));
  }
});

Deno.test("moderatePremiumChatProviderReply: a crisis safety flag alone (clean text) also triggers the backstop", () => {
  const result = moderatePremiumChatProviderReply({ text: "Let's talk about your garden.", safetyFlags: ["self_harm"] }, "en");
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.moderated, true);
    assert(result.safetyFlags.includes("crisis_escalation"));
  }
});

Deno.test("moderatePremiumChatProviderReply: professional-advice content is softened, not rejected", () => {
  const result = moderatePremiumChatProviderReply({ text: "I'll give you medical advice now.", safetyFlags: [] }, "en");
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.moderated, true);
    assert(result.safetyFlags.includes("professional_advice_boundary"));
    assertFalse(result.text.includes("medical advice"));
  }
});

Deno.test("moderatePremiumChatProviderReply: an ordinary clean reply passes through unmoderated", () => {
  const result = moderatePremiumChatProviderReply({ text: "  I'm here with you in the garden.  ", safetyFlags: [] }, "en");
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.moderated, false);
    assertEquals(result.text, "I'm here with you in the garden.");
    assertEquals(result.safetyFlags, []);
  }
});

Deno.test("moderatePremiumChatProviderReply: safety flags are normalized, deduplicated, and symbol-only junk is dropped", () => {
  const result = moderatePremiumChatProviderReply(
    { text: "Just a cozy chat.", safetyFlags: [" Cozy-Flag ", "cozy-flag", "!!!"] },
    "en"
  );
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.safetyFlags, ["cozy-flag"]);
  }
});
