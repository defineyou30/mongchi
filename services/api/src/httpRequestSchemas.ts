import { z } from "zod";

const idSchema = z.string().min(1);
const optionalTextSchema = z.string().optional();
const personalityTagSchema = z.enum(["playful", "calm", "shy", "curious", "sleepy", "affectionate"]);
const talkingStyleSchema = z.enum(["cute", "gentle", "cheerful", "comforting"]);

const restorePurchaseItemSchema = z
  .object({
    productId: idSchema,
    transactionId: idSchema,
    receiptHash: idSchema,
    storeVerificationToken: z.string()
  })
  .strict();

export const apiMutationBodySchemas = {
  empty: z.undefined(),
  createPet: z
    .object({
      name: z.string(),
      species: z.enum(["dog", "cat"]),
      personalityTags: z.array(personalityTagSchema),
      talkingStyle: talkingStyleSchema,
      favoriteThing: optionalTextSchema
    })
    .strict(),
  updatePet: z
    .object({
      name: optionalTextSchema,
      personalityTags: z.array(personalityTagSchema).optional(),
      talkingStyle: talkingStyleSchema.optional(),
      favoriteThing: optionalTextSchema,
      memoryNote: optionalTextSchema
    })
    .strict(),
  careAction: z
    .object({
      action: z.enum(["feed", "talk", "walk", "play", "rest", "affection", "water_garden", "clean", "treat"]),
      itemId: idSchema.optional(),
      occurredAt: z.string()
    })
    .strict(),
  photoUploadUrl: z
    .object({
      petId: idSchema,
      contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      byteSize: z.number()
    })
    .strict(),
  completePhotoUpload: z
    .object({
      photoId: idSchema,
      contentHash: z.string()
    })
    .strict(),
  createGenerationJob: z
    .object({
      petId: idSchema,
      sourcePhotoIds: z.array(idSchema),
      optionalPhotoIds: z.array(idSchema)
    })
    .strict(),
  acceptGenerationJob: z
    .object({
      jobId: idSchema.optional(),
      acceptedAssetIds: z.array(idSchema)
    })
    .strict(),
  generationIssueReport: z
    .object({
      petId: idSchema,
      generationJobId: idSchema.optional(),
      category: z.enum(["wrong_pet", "unsafe_or_scary", "poor_quality"])
    })
    .strict(),
  createConversation: z
    .object({
      petId: idSchema,
      disclosureAccepted: z.boolean()
    })
    .strict(),
  sendConversationMessage: z
    .object({
      conversationId: idSchema.optional(),
      text: z.string()
    })
    .strict(),
  weatherLookup: z
    .object({
      approximateLatitude: z.number(),
      approximateLongitude: z.number(),
      requestedAt: z.string(),
      locale: z.enum(["ko-KR", "en-US"]).optional()
    })
    .strict(),
  inventoryItem: z
    .object({
      itemId: idSchema
    })
    .strict(),
  deleteOriginalPhotos: z
    .object({
      petId: idSchema
    })
    .strict(),
  verifyPurchase: z
    .object({
      platform: z.enum(["ios", "android"]),
      productId: idSchema,
      transactionId: idSchema,
      receiptHash: z.string(),
      storeVerificationToken: z.string().optional()
    })
    .strict(),
  restorePurchases: z
    .object({
      platform: z.enum(["ios", "android"]),
      transactionIds: z.array(idSchema),
      purchases: z.array(restorePurchaseItemSchema).optional()
    })
    .strict(),
  commerceWebhook: z.record(z.unknown()),
  purchaseRevocation: z
    .object({
      platform: z.enum(["ios", "android"]),
      transactionId: idSchema,
      reason: z.enum(["refund", "chargeback", "developer_revoke", "store_revoke"])
    })
    .strict()
} as const;

export type RequestBodyParseResult<Output> =
  | {
      readonly ok: true;
      readonly data: Output;
    }
  | {
      readonly ok: false;
    };

export const parseRequestBody = <Output>(schema: z.ZodType<Output>, body: unknown): RequestBodyParseResult<Output> => {
  const parsed = schema.safeParse(body);

  return parsed.success
    ? {
        ok: true,
        data: parsed.data
      }
    : {
        ok: false
      };
};
