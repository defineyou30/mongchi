import { describe, expect, it } from "vitest";

import {
  buildCareActionRequest,
  buildApproximateWeatherLookupRequest,
  buildChatCareContext,
  buildChatMemoryContext,
  buildChatTurnPetProfile,
  buildCreateGenerationJobRequest,
  buildCreatePetRequest,
  buildPhotoUploadUrlRequest,
  createInitialCareStats,
  mockCareState,
  mockPetProfile,
  validateLocalPhotoCandidate
} from "../index";
import type {
  CareStats,
  ChatTurnResponse,
  CreateConversationRequest,
  MemoryEntry,
  PurchaseChatPassRequest,
  PurchaseChatPassResponse,
  PurchaseVerificationRequest,
  RestorePurchasesRequest
} from "../index";

/** Builds an ISO string whose *local* hour is `hour` -- buildChatCareContext's night read re-derives the hour via isNightTime -> `new Date(iso).getHours()`, so round-tripping through setHours keeps this independent of the test runner's timezone (mirrors dayNightCycle.test.ts's isoAtLocalHour). */
const isoAtLocalHour = (hour: number): string => {
  const date = new Date("2026-06-24T00:00:00.000Z");
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

describe("mobile API contract mappers", () => {
  it("maps pet setup draft into a trimmed create-pet request", () => {
    const request = buildCreatePetRequest({
      name: "  Bori  ",
      species: "cat",
      personalityTags: ["curious", "sleepy"],
      talkingStyle: "cute",
      favoriteThing: "  sun spots  "
    });

    expect(request).toEqual({
      name: "Bori",
      species: "cat",
      personalityTags: ["curious", "sleepy"],
      talkingStyle: "cute",
      favoriteThing: "sun spots"
    });
  });

  it("validates local photo candidates before upload preparation", () => {
    expect(
      validateLocalPhotoCandidate({
        uri: "file:///tmp/pet-photo.jpg",
        byteSize: 2_048,
        mimeType: null
      })
    ).toEqual({
      ok: true,
      contentType: "image/jpeg",
      byteSize: 2_048
    });

    expect(
      validateLocalPhotoCandidate({
        uri: "file:///tmp/pet-photo.gif",
        byteSize: 2_048,
        mimeType: "image/gif"
      })
    ).toMatchObject({
      ok: false,
      issue: "unsupported_type"
    });

    expect(
      validateLocalPhotoCandidate({
        uri: "file:///tmp/pet-photo.webp",
        byteSize: 11 * 1024 * 1024,
        mimeType: "image/webp"
      })
    ).toMatchObject({
      ok: false,
      issue: "too_large"
    });
  });

  it("builds signed upload, generation, and care requests without provider secrets", () => {
    expect(
      buildPhotoUploadUrlRequest("pet_001", {
        uri: "file:///tmp/pet-photo.png",
        byteSize: 4096,
        mimeType: "image/png"
      })
    ).toEqual({
      ok: true,
      request: {
        petId: "pet_001",
        contentType: "image/png",
        byteSize: 4096
      }
    });

    expect(
      buildPhotoUploadUrlRequest("pet_001", {
        uri: "file:///tmp/pet-photo.png",
        mimeType: "image/png"
      })
    ).toMatchObject({
      ok: false,
      issue: "missing_size"
    });

    expect(buildCreateGenerationJobRequest("pet_001", "photo_001")).toEqual({
      petId: "pet_001",
      sourcePhotoIds: ["photo_001"],
      optionalPhotoIds: []
    });

    expect(buildCareActionRequest("feed", "2026-06-24T09:00:00.000Z")).toEqual({
      action: "feed",
      occurredAt: "2026-06-24T09:00:00.000Z"
    });
  });

  it("builds approximate weather lookup requests without preserving precise coordinates", () => {
    expect(
      buildApproximateWeatherLookupRequest(
        {
          latitude: 37.566535,
          longitude: 126.977969,
          accuracyMeters: 42
        },
        "2026-06-24T09:00:00.000Z",
        "ko-KR"
      )
    ).toEqual({
      ok: true,
      request: {
        approximateLatitude: 37.6,
        approximateLongitude: 127,
        requestedAt: "2026-06-24T09:00:00.000Z",
        locale: "ko-KR"
      }
    });

    expect(
      buildApproximateWeatherLookupRequest(
        {
          latitude: 120,
          longitude: 126.977969
        },
        "2026-06-24T09:00:00.000Z"
      )
    ).toMatchObject({
      ok: false,
      issue: "invalid_coordinates"
    });
  });

  it("allows a server-only store verification token on purchase requests", () => {
    const request: PurchaseVerificationRequest = {
      platform: "ios",
      productId: "premium_chat_monthly",
      transactionId: "ios_txn_001",
      receiptHash: `sha256:${"a".repeat(64)}`,
      storeVerificationToken: "app-store-jws.header.payload.signature"
    };

    expect(request.storeVerificationToken).toBe("app-store-jws.header.payload.signature");
  });

  it("allows request-scoped store tokens on restore requests", () => {
    const request: RestorePurchasesRequest = {
      platform: "android",
      transactionIds: ["gpa.1234-5678-9012"],
      purchases: [
        {
          productId: "premium_chat_monthly",
          transactionId: "gpa.1234-5678-9012",
          receiptHash: `sha256:${"b".repeat(64)}`,
          storeVerificationToken: "google-play-purchase-token"
        }
      ]
    };

    expect(request.purchases?.[0]?.storeVerificationToken).toBe("google-play-purchase-token");
  });

  it("builds a chat memory context with the most recent memories and favorite care habits", () => {
    const memories: MemoryEntry[] = [
      { id: "mem_1", type: "moved_in", occurredAt: "2026-06-01T09:00:00.000Z", line: "The day I moved into the garden." },
      { id: "mem_2", type: "first_walk", occurredAt: "2026-06-10T09:00:00.000Z", line: "I came back from my very first walk with you." },
      { id: "mem_3", type: "bond_level", occurredAt: "2026-06-20T09:00:00.000Z", line: "Our bond reached a new level.", refs: { bondLevel: 2 } }
    ];
    const careStats: CareStats = {
      ...createInitialCareStats(),
      actionCounts: { clean: 5, feed: 2 },
      treatItemCounts: { treat_biscuit: 3 },
      totalCareActions: 10
    };

    expect(buildChatMemoryContext({ memories, careStats })).toEqual({
      recentMemories: [
        { type: "bond_level", line: "Our bond reached a new level." },
        { type: "first_walk", line: "I came back from my very first walk with you." },
        { type: "moved_in", line: "The day I moved into the garden." }
      ],
      favoriteCareAction: "clean",
      favoriteTreatItemId: "treat_biscuit"
    });
  });

  it("caps the memory context at the 5 most recent memories", () => {
    const memories: MemoryEntry[] = Array.from({ length: 8 }, (_, index) => ({
      id: `mem_${index}`,
      type: "rare_find" as const,
      occurredAt: `2026-06-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`,
      line: `Rare find number ${index}`
    }));

    const context = buildChatMemoryContext({ memories, careStats: createInitialCareStats() });

    expect(context.recentMemories).toHaveLength(5);
    expect(context.recentMemories[0]).toEqual({ type: "rare_find", line: "Rare find number 7" });
  });

  it("returns null habit hints when there is no care history yet", () => {
    expect(buildChatMemoryContext({ memories: [], careStats: createInitialCareStats() })).toEqual({
      recentMemories: [],
      favoriteCareAction: null,
      favoriteTreatItemId: null
    });
  });

  it("accepts an optional memoryContext field on CreateConversationRequest without requiring it", () => {
    const withoutContext: CreateConversationRequest = {
      petId: "pet_001",
      disclosureAccepted: true
    };
    const withContext: CreateConversationRequest = {
      petId: "pet_001",
      disclosureAccepted: true,
      memoryContext: buildChatMemoryContext({ memories: [], careStats: createInitialCareStats() })
    };

    expect(withoutContext.memoryContext).toBeUndefined();
    expect(withContext.memoryContext?.favoriteCareAction).toBeNull();
  });

  it("builds a chat-turn care context from the six live care meters plus daysAway", () => {
    expect(buildChatCareContext(mockCareState, 2, isoAtLocalHour(9))).toEqual({
      satiety: 48,
      energy: 74,
      happiness: 70,
      affection: 66,
      cleanliness: 76,
      gardenHealth: 58,
      daysAway: 2,
      localTimeOfDay: "day"
    });
  });

  it("includes a zero daysAway rather than omitting it", () => {
    expect(buildChatCareContext(mockCareState, 0, isoAtLocalHour(9))).toEqual({
      satiety: 48,
      energy: 74,
      happiness: 70,
      affection: 66,
      cleanliness: 76,
      gardenHealth: 58,
      daysAway: 0,
      localTimeOfDay: "day"
    });
  });

  it("reads localTimeOfDay as night during the 22:00-05:59 sleep window", () => {
    expect(buildChatCareContext(mockCareState, 0, isoAtLocalHour(23)).localTimeOfDay).toBe("night");
    expect(buildChatCareContext(mockCareState, 0, isoAtLocalHour(3)).localTimeOfDay).toBe("night");
    expect(buildChatCareContext(mockCareState, 0, isoAtLocalHour(6)).localTimeOfDay).toBe("day");
  });

  it("trims a full pet profile down to the chat-turn snapshot, dropping empty optional fields", () => {
    expect(buildChatTurnPetProfile(mockPetProfile)).toEqual({
      name: "Miso",
      species: "dog",
      personalityTags: ["curious", "affectionate"],
      talkingStyle: "gentle",
      favoriteThing: "cloud-shaped leaves"
    });

    const { favoriteThing: _favoriteThing, memoryNote: _memoryNote, ...petProfileWithoutOptionalFields } = mockPetProfile;

    expect(
      buildChatTurnPetProfile({
        ...petProfileWithoutOptionalFields,
        personalityTags: []
      })
    ).toEqual({
      name: "Miso",
      species: "dog",
      talkingStyle: "gentle"
    });
  });

  it("accepts the day_pass charge kind on ChatTurnResponse (Chat Live BM decision: chatty day pass)", () => {
    const chargeKind: ChatTurnResponse["chargeKind"] = "day_pass";

    expect(chargeKind).toBe("day_pass");
  });

  it("shapes the purchase-chat-pass request/response contract", () => {
    const request: PurchaseChatPassRequest = { request_id: "purchase_req_001" };
    const response: PurchaseChatPassResponse = {
      dayPassExpiresAt: "2026-07-14T09:00:00.000Z",
      serverBalance: 4
    };

    expect(request.request_id).toBe("purchase_req_001");
    expect(response).toEqual({
      dayPassExpiresAt: "2026-07-14T09:00:00.000Z",
      serverBalance: 4
    });
  });
});
