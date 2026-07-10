import type { HttpMethod } from "./contracts";
import { apiMutationBodySchemas, parseRequestBody } from "./httpRequestSchemas";
import type { RequestBodyParseResult } from "./httpRequestSchemas";

export type ApiMutationBodyParseResult =
  | {
      readonly kind: "not_mutation";
    }
  | {
      readonly kind: "valid";
      readonly body: unknown;
    }
  | {
      readonly kind: "invalid";
    };

const fromSchema = <Output>(result: RequestBodyParseResult<Output>): ApiMutationBodyParseResult =>
  result.ok
    ? {
        kind: "valid",
        body: result.data
      }
    : {
        kind: "invalid"
      };

export const parseApiMutationBody = (
  method: HttpMethod,
  segments: readonly string[],
  body: unknown
): ApiMutationBodyParseResult => {
  const [version, resource, id, action, nestedAction] = segments;

  if (version !== "v1") {
    return { kind: "not_mutation" };
  }

  if (resource === "pets") {
    if (method === "POST" && !id) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.createPet, body));
    }

    if (method === "PATCH" && id && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.updatePet, body));
    }

    if (method === "DELETE" && id && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }

    if (method === "POST" && id && action === "care-actions" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.careAction, body));
    }

    if (method === "POST" && id && action === "walks" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }
  }

  if (method === "POST" && resource === "photos" && id === "upload-url" && !action) {
    return fromSchema(parseRequestBody(apiMutationBodySchemas.photoUploadUrl, body));
  }

  if (method === "POST" && resource === "photos" && id === "complete-upload" && !action) {
    return fromSchema(parseRequestBody(apiMutationBodySchemas.completePhotoUpload, body));
  }

  if (resource === "generation-jobs" && method === "POST") {
    if (!id) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.createGenerationJob, body));
    }

    if ((action === "retry" || action === "poll") && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }

    if (action === "accept" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.acceptGenerationJob, body));
    }
  }

  if (method === "POST" && resource === "generation-issue-reports" && !id) {
    return fromSchema(parseRequestBody(apiMutationBodySchemas.generationIssueReport, body));
  }

  if (resource === "conversations") {
    if (method === "POST" && !id) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.createConversation, body));
    }

    if (method === "POST" && id && action === "messages" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.sendConversationMessage, body));
    }

    if (method === "DELETE" && id && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }
  }

  if (method === "POST" && resource === "walks" && id && action === "claim" && !nestedAction) {
    return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
  }

  if (method === "POST" && resource === "weather" && id === "current" && !action) {
    return fromSchema(parseRequestBody(apiMutationBodySchemas.weatherLookup, body));
  }

  if (resource === "inventory") {
    if (method === "POST" && id === "purchases" && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.inventoryItem, body));
    }

    if (method === "POST" && id === "placements" && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.inventoryItem, body));
    }

    if (method === "DELETE" && id === "placements" && action && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }
  }

  if (resource === "privacy" && method === "DELETE") {
    if (id === "original-photos" && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.deleteOriginalPhotos, body));
    }

    if ((id === "chat-history" && !action) || (id === "pet" && action && !nestedAction)) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.empty, body));
    }
  }

  if (resource === "commerce" && method === "POST") {
    if (id === "purchases" && action === "verify" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.verifyPurchase, body));
    }

    if (id === "restore" && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.restorePurchases, body));
    }

    if (id === "store-webhooks" && !action) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.commerceWebhook, body));
    }

    if (id === "purchases" && action === "revoke" && !nestedAction) {
      return fromSchema(parseRequestBody(apiMutationBodySchemas.purchaseRevocation, body));
    }
  }

  return { kind: "not_mutation" };
};
