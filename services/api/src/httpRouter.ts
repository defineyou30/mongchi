import type { CareActionRequest } from "@mongchi/shared";

import type {
  AcceptGenerationJobRequest,
  CompletePhotoUploadRequest,
  CreateConversationRequest,
  CreateGenerationJobRequest,
  CreatePetRequest,
  DeleteOriginalPhotosRequest,
  GenerationIssueReportRequest,
  HttpMethod,
  PlaceInventoryItemRequest,
  PhotoUploadUrlRequest,
  PurchaseInventoryItemRequest,
  PurchaseReceiptRevocationRequest,
  PurchaseRevocationRequest,
  PurchaseVerificationRequest,
  RestorePurchasesRequest,
  SendConversationMessageRequest,
  UpdatePetRequest,
  WeatherLookupRequest
} from "./contracts";
import { normalizeCommerceStoreWebhookNotification } from "./commerceStoreWebhook";
import type { CommerceStoreWebhookDecision, CommerceStoreWebhookOptions } from "./commerceStoreWebhook";
import type { ApiAuthContext, ApiResult, ApiService, MaybePromise } from "./service";
import { createMockApiService } from "./service";
import type { StorePurchaseVerifier } from "./purchaseVerifier";
import type { ApiSessionVerifier } from "./sessionVerifier";
import type { PrivateStorageSigner } from "./storageSigner";

export interface ApiHttpRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: Record<string, string | undefined>;
}

export interface ApiHttpResponse {
  status: number;
  body: unknown;
}

export type ApiAuthResolver = (request: ApiHttpRequest) => ApiAuthContext;

export interface DefaultApiAuthResolverOptions {
  allowMockAuth?: boolean;
}

export interface ApiHttpRouterOptions {
  service?: ApiService;
  resolveAuthContext?: ApiAuthResolver;
  allowMockAuth?: boolean;
  allowMockPurchaseVerification?: boolean;
  allowMockStorageSigning?: boolean;
  purchaseVerifier?: StorePurchaseVerifier;
  sessionVerifier?: ApiSessionVerifier;
  privateStorageSigner?: PrivateStorageSigner;
  commerceWebhookSecret?: string;
  storeWebhookOptions?: CommerceStoreWebhookOptions;
  commerceWebhookLogger?: CommerceWebhookLogger;
}

export interface CommerceWebhookLogger {
  info?: (event: string, metadata: Record<string, unknown>) => void;
  error?: (event: string, metadata: Record<string, unknown>) => void;
}

const getHeader = (headers: ApiHttpRequest["headers"], key: string): string | undefined =>
  headers?.[key] ?? headers?.[key.toLowerCase()] ?? headers?.[key.toUpperCase()];

const resolveLocale = (headers: ApiHttpRequest["headers"]) => (getHeader(headers, "x-locale") === "en-US" ? "en-US" : "ko-KR");
const resolveTimezone = (headers: ApiHttpRequest["headers"]) => getHeader(headers, "x-timezone") ?? "Asia/Seoul";
const getBearerToken = (headers: ApiHttpRequest["headers"]): { authorization: string; token: string } | null => {
  const authorization = getHeader(headers, "authorization")?.trim();
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch?.[1]?.trim();

  return authorization && token ? { authorization, token } : null;
};

export const createDefaultApiAuthResolver = (options: DefaultApiAuthResolverOptions = {}): ApiAuthResolver => {
  const allowMockAuth = options.allowMockAuth ?? true;

  return (request) => {
    const bearerToken = getBearerToken(request.headers)?.token ?? null;
    const mockUserId = getHeader(request.headers, "x-mock-user-id")?.trim() || null;

    return {
      userId: allowMockAuth ? mockUserId ?? bearerToken ?? null : null,
      locale: resolveLocale(request.headers),
      timezone: resolveTimezone(request.headers)
    };
  };
};

const asyncServiceRequiresAsyncHandler = (): ApiHttpResponse => ({
  status: 503,
  body: {
    error: {
      status: 503,
      code: "async_service_requires_async_handler",
      messageSafe: "The configured API service requires the async request handler."
    }
  }
});

const isPromiseLike = <T>(value: MaybePromise<T>): value is Promise<T> =>
  typeof (value as Promise<T> | { then?: unknown }).then === "function";

const resultToHttpResponse = <T>(result: MaybePromise<ApiResult<T>>): ApiHttpResponse => {
  if (isPromiseLike(result)) {
    return asyncServiceRequiresAsyncHandler();
  }

  return result.ok
    ? {
        status: result.status,
        body: result.data
      }
    : {
        status: result.error.status,
        body: {
          error: result.error
        }
      };
};

const resultToHttpResponseAsync = async <T>(result: MaybePromise<ApiResult<T>>): Promise<ApiHttpResponse> =>
  resultToHttpResponse(await result);

const parsePath = (path: string): string[] => {
  const pathOnly = path.split("?")[0] ?? path;
  const trimmed = pathOnly.replace(/\/+$/, "");

  return trimmed.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
};

const notFound = (): ApiHttpResponse => ({
  status: 404,
  body: {
    error: {
      status: 404,
      code: "route_not_found",
      messageSafe: "Route not found."
    }
  }
});

const pathBodyMismatch = (): ApiHttpResponse => ({
  status: 422,
  body: {
    error: {
      status: 422,
      code: "path_body_mismatch",
      messageSafe: "Request path and body do not match."
    }
  }
});

const authVerifierErrorResponse = (error: { status: 401 | 403 | 503; code: string; messageSafe: string }): ApiHttpResponse => ({
  status: error.status,
  body: {
    error
  }
});

const commerceWebhookUnavailable = (): ApiHttpResponse => ({
  status: 503,
  body: {
    error: {
      status: 503,
      code: "commerce_webhook_unavailable",
      messageSafe: "Commerce webhook verification is not configured."
    }
  }
});

const commerceWebhookForbidden = (): ApiHttpResponse => ({
  status: 403,
  body: {
    error: {
      status: 403,
      code: "commerce_webhook_forbidden",
      messageSafe: "Commerce webhook verification failed."
    }
  }
});

const commerceWebhookInvalidPayload = (error: { status: 422; code: string; messageSafe: string }): ApiHttpResponse => ({
  status: error.status,
  body: {
    error
  }
});

const commerceWebhookIgnored = (eventType: string): ApiHttpResponse => ({
  status: 202,
  body: {
    ignored: true,
    reason: "store_notification_not_relevant",
    eventType
  }
});

type CommerceWebhookFailureReason = "secret_unavailable" | "secret_mismatch";

interface CommerceWebhookVerificationFailure {
  reason: CommerceWebhookFailureReason;
  response: ApiHttpResponse;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isHttpResponse = (value: unknown): value is ApiHttpResponse =>
  isRecord(value) && typeof value.status === "number" && "body" in value;

const withJobIdFromPath = (jobId: string, body: unknown): AcceptGenerationJobRequest | ApiHttpResponse => {
  if (isRecord(body) && typeof body.jobId === "string" && body.jobId !== jobId) {
    return pathBodyMismatch();
  }

  return {
    ...(isRecord(body) ? body : {}),
    jobId
  } as AcceptGenerationJobRequest;
};

const isSafeWebhookSecret = (value: string | undefined): value is string => {
  const trimmed = value?.trim();

  return !!trimmed && trimmed.length >= 16 && trimmed.length <= 256 && !/[\u0000-\u001f\s]/.test(trimmed);
};

export function createApiHttpRouter(options: ApiHttpRouterOptions = {}) {
  const service =
    options.service ??
    createMockApiService({
      ...(options.allowMockPurchaseVerification === undefined
        ? {}
        : { allowMockPurchaseVerification: options.allowMockPurchaseVerification }),
      ...(options.allowMockStorageSigning === undefined ? {} : { allowMockStorageSigning: options.allowMockStorageSigning }),
      ...(options.purchaseVerifier ? { purchaseVerifier: options.purchaseVerifier } : {}),
      ...(options.privateStorageSigner ? { privateStorageSigner: options.privateStorageSigner } : {})
    });
  const defaultAuthOptions =
    options.allowMockAuth === undefined
      ? {}
      : {
          allowMockAuth: options.allowMockAuth
        };
  const resolveAuthContext = options.resolveAuthContext ?? createDefaultApiAuthResolver(defaultAuthOptions);
  const serviceRequiresAsyncHandler = (service as { asyncOnly?: boolean }).asyncOnly === true;
  const logCommerceWebhook = (level: "info" | "error", event: string, metadata: Record<string, unknown>): void => {
    try {
      options.commerceWebhookLogger?.[level]?.(event, metadata);
    } catch {
      // Operational logging must never break API responses.
    }
  };
  const verifyCommerceWebhookDetailed = (request: ApiHttpRequest): CommerceWebhookVerificationFailure | null => {
    const expectedSecret = options.commerceWebhookSecret;

    if (!isSafeWebhookSecret(expectedSecret)) {
      return {
        reason: "secret_unavailable",
        response: commerceWebhookUnavailable()
      };
    }

    return getHeader(request.headers, "x-tiny-pet-commerce-webhook-secret")?.trim() === expectedSecret
      ? null
      : {
          reason: "secret_mismatch",
          response: commerceWebhookForbidden()
        };
  };
  const verifyCommerceWebhook = (request: ApiHttpRequest): ApiHttpResponse | null => verifyCommerceWebhookDetailed(request)?.response ?? null;
  const logCommerceWebhookServiceResult = <T>(
    decision: CommerceStoreWebhookDecision,
    result: ApiResult<T>
  ): void => {
    const baseMetadata = {
      source: decision.source,
      action: decision.action,
      ...(decision.action !== "ignore" ? { platform: decision.request.platform, reason: decision.request.reason } : {})
    };

    if (result.ok) {
      logCommerceWebhook("info", "commerce_store_webhook_processed", {
        ...baseMetadata,
        status: result.status
      });
      return;
    }

    logCommerceWebhook("error", "commerce_store_webhook_rejected", {
      ...baseMetadata,
      status: result.error.status,
      errorCode: result.error.code
    });
  };
  const withCommerceWebhookServiceLogging = <T>(
    decision: CommerceStoreWebhookDecision,
    result: MaybePromise<ApiResult<T>>
  ): MaybePromise<ApiResult<T>> => {
    if (isPromiseLike(result)) {
      return result.then((resolved) => {
        logCommerceWebhookServiceResult(decision, resolved);

        return resolved;
      });
    }

    logCommerceWebhookServiceResult(decision, result);

    return result;
  };
  const routeCommerceStoreWebhook = <Response>(
    request: ApiHttpRequest,
    respond: <T>(result: MaybePromise<ApiResult<T>>) => Response,
    staticResponse: (response: ApiHttpResponse) => Response
  ): Response => {
    const webhookError = verifyCommerceWebhookDetailed(request);

    if (webhookError) {
      logCommerceWebhook("error", "commerce_store_webhook_rejected", {
        reason: webhookError.reason,
        status: webhookError.response.status
      });

      return staticResponse(webhookError.response);
    }

    const normalized = normalizeCommerceStoreWebhookNotification(request.body, options.storeWebhookOptions);

    if (!normalized.ok) {
      logCommerceWebhook("error", "commerce_store_webhook_rejected", {
        reason: "invalid_payload",
        status: normalized.error.status,
        errorCode: normalized.error.code
      });

      return staticResponse(commerceWebhookInvalidPayload(normalized.error));
    }

    if (normalized.decision.action === "ignore") {
      logCommerceWebhook("info", "commerce_store_webhook_ignored", {
        source: normalized.decision.source,
        eventType: normalized.decision.eventType,
        status: 202
      });

      return staticResponse(commerceWebhookIgnored(normalized.decision.eventType));
    }

    if (normalized.decision.action === "revoke_by_receipt_hash") {
      return respond(
        withCommerceWebhookServiceLogging(
          normalized.decision,
          service.revokePurchaseByReceiptHash(normalized.decision.request as PurchaseReceiptRevocationRequest)
        )
      );
    }

    return respond(withCommerceWebhookServiceLogging(normalized.decision, service.revokePurchase(normalized.decision.request as PurchaseRevocationRequest)));
  };

  const routeWithAuthContext = <Response>(
    request: ApiHttpRequest,
    authContext: ApiAuthContext,
    respond: <T>(result: MaybePromise<ApiResult<T>>) => Response,
    staticResponse: (response: ApiHttpResponse) => Response
  ): Response => {
      const [version, resource, id, action, nestedAction] = parsePath(request.path);

      if (version !== "v1") {
        return staticResponse(notFound());
      }

      if (request.method === "GET" && resource === "me" && !id) {
        return respond(service.getCurrentUser(authContext));
      }

      if (resource === "pets") {
        if (request.method === "GET" && !id) {
          return respond(service.listPets(authContext));
        }

        if (request.method === "POST" && !id) {
          return respond(service.createPet(authContext, request.body as CreatePetRequest));
        }

        if (request.method === "PATCH" && id && !action) {
          return respond(service.updatePet(authContext, id, request.body as UpdatePetRequest));
        }

        if (request.method === "DELETE" && id && !action) {
          return respond(service.deletePet(authContext, id));
        }

        if (request.method === "GET" && id && action === "assets" && !nestedAction) {
          return respond(service.listGeneratedAssets(authContext, id));
        }

        if (request.method === "GET" && id && action === "care-state" && !nestedAction) {
          return respond(service.getCareState(authContext, id));
        }

        if (request.method === "GET" && id && action === "relationship-state" && !nestedAction) {
          return respond(service.getRelationshipState(authContext, id));
        }

        if (request.method === "POST" && id && action === "care-actions" && !nestedAction) {
          return respond(service.performCareAction(authContext, id, request.body as CareActionRequest));
        }

        if (request.method === "POST" && id && action === "walks" && !nestedAction) {
          return respond(service.startWalk(authContext, id));
        }
      }

      if (request.method === "POST" && resource === "photos" && id === "upload-url" && !action) {
        return respond(service.issuePhotoUploadUrl(authContext, request.body as PhotoUploadUrlRequest));
      }

      if (request.method === "POST" && resource === "photos" && id === "complete-upload" && !action) {
        return respond(service.completePhotoUpload(authContext, request.body as CompletePhotoUploadRequest));
      }

      if (resource === "generation-jobs") {
        if (request.method === "POST" && !id) {
          return respond(service.createGenerationJob(authContext, request.body as CreateGenerationJobRequest));
        }

        if (request.method === "GET" && id && !action) {
          return respond(service.getGenerationJob(authContext, id));
        }

        if (request.method === "POST" && id && action === "retry" && !nestedAction) {
          return respond(service.retryGenerationJob(authContext, id));
        }

        if (request.method === "POST" && id && action === "poll" && !nestedAction) {
          return respond(service.pollGenerationJob(authContext, id));
        }

        if (request.method === "POST" && id && action === "accept" && !nestedAction) {
          const requestBody = withJobIdFromPath(id, request.body);

          if (isHttpResponse(requestBody)) {
            return staticResponse(requestBody);
          }

          return respond(service.acceptGenerationJob(authContext, requestBody));
        }
      }

      if (request.method === "POST" && resource === "generation-issue-reports" && !id) {
        return respond(service.reportGenerationIssue(authContext, request.body as GenerationIssueReportRequest));
      }

      if (request.method === "POST" && resource === "conversations" && !id) {
        return respond(service.createPremiumConversation(authContext, request.body as CreateConversationRequest));
      }

      if (request.method === "GET" && resource === "conversations" && id && !action) {
        return respond(service.getConversationThread(authContext, id));
      }

      if (request.method === "POST" && resource === "conversations" && id && action === "messages" && !nestedAction) {
        return respond(
          service.sendPremiumConversationMessage(authContext, {
            ...(isRecord(request.body) ? request.body : {}),
            conversationId: id
          } as SendConversationMessageRequest)
        );
      }

      if (request.method === "DELETE" && resource === "conversations" && id && !action) {
        return respond(service.deleteConversation(authContext, id));
      }

      if (request.method === "POST" && resource === "walks" && id && action === "claim" && !nestedAction) {
        return respond(service.claimWalkReward(authContext, id));
      }

      if (request.method === "POST" && resource === "weather" && id === "current" && !action) {
        return respond(service.getCurrentWeather(authContext, request.body as WeatherLookupRequest));
      }

      if (request.method === "GET" && resource === "assets" && id && action === "signed-url" && !nestedAction) {
        return respond(service.issueGeneratedAssetReadUrl(authContext, id));
      }

      if (request.method === "GET" && resource === "reaction-catalog" && !id) {
        return respond(service.getReactionCatalog(authContext));
      }

      if (request.method === "GET" && resource === "catalog" && id === "items" && !action) {
        return respond(service.getItemCatalog(authContext));
      }

      if (request.method === "GET" && resource === "inventory" && !id) {
        return respond(service.getInventory(authContext));
      }

      if (request.method === "POST" && resource === "inventory" && id === "purchases" && !action) {
        return respond(service.purchaseInventoryItem(authContext, request.body as PurchaseInventoryItemRequest));
      }

      if (request.method === "POST" && resource === "inventory" && id === "placements" && !action) {
        return respond(service.placeInventoryItem(authContext, request.body as PlaceInventoryItemRequest));
      }

      if (request.method === "DELETE" && resource === "inventory" && id === "placements" && action && !nestedAction) {
        return respond(service.removePlacedItem(authContext, action));
      }

      if (request.method === "GET" && resource === "entitlements" && !id) {
        return respond(service.listEntitlements(authContext));
      }

      if (resource === "privacy") {
        if (request.method === "DELETE" && id === "original-photos" && !action) {
          return respond(service.deleteOriginalPhotos(authContext, request.body as DeleteOriginalPhotosRequest));
        }

        if (request.method === "DELETE" && id === "chat-history" && !action) {
          return respond(service.deleteChatHistory(authContext));
        }

        if (request.method === "DELETE" && id === "pet" && action && !nestedAction) {
          return respond(service.deletePet(authContext, action));
        }
      }

      if (request.method === "GET" && resource === "commerce" && id === "products" && !action) {
        return respond(service.listCommerceProducts(authContext));
      }

      if (request.method === "POST" && resource === "commerce" && id === "purchases" && action === "verify" && !nestedAction) {
        return respond(service.verifyPurchase(authContext, request.body as PurchaseVerificationRequest));
      }

      if (request.method === "POST" && resource === "commerce" && id === "restore" && !action) {
        return respond(service.restorePurchases(authContext, request.body as RestorePurchasesRequest));
      }

      if (request.method === "POST" && resource === "commerce" && id === "store-webhooks" && !action) {
        return routeCommerceStoreWebhook(request, respond, staticResponse);
      }

      if (request.method === "POST" && resource === "commerce" && id === "purchases" && action === "revoke" && !nestedAction) {
        const webhookError = verifyCommerceWebhook(request);

        if (webhookError) {
          return staticResponse(webhookError);
        }

        return respond(service.revokePurchase(request.body as PurchaseRevocationRequest));
      }

      return staticResponse(notFound());
  };

  const handleWithAuthContext = (request: ApiHttpRequest, authContext: ApiAuthContext): ApiHttpResponse =>
    serviceRequiresAsyncHandler
      ? asyncServiceRequiresAsyncHandler()
      : routeWithAuthContext(request, authContext, resultToHttpResponse, (response) => response);

  const handleWithAuthContextAsync = (request: ApiHttpRequest, authContext: ApiAuthContext): Promise<ApiHttpResponse> =>
    routeWithAuthContext(request, authContext, resultToHttpResponseAsync, async (response) => response);

  const handle = (request: ApiHttpRequest): ApiHttpResponse => handleWithAuthContext(request, resolveAuthContext(request));

  const resolveAsyncAuthContext = async (request: ApiHttpRequest): Promise<ApiAuthContext | ApiHttpResponse> => {
    if (!options.sessionVerifier) {
      return resolveAuthContext(request);
    }

    const bearer = getBearerToken(request.headers);

    if (!bearer) {
      return {
        userId: null,
        locale: resolveLocale(request.headers),
        timezone: resolveTimezone(request.headers)
      };
    }

    const verified = await options.sessionVerifier.verifySession({
      token: bearer.token,
      authorizationHeader: bearer.authorization,
      locale: resolveLocale(request.headers),
      timezone: resolveTimezone(request.headers)
    });

    if (!verified.ok) {
      return authVerifierErrorResponse(verified.error);
    }

    return {
      userId: verified.session.userId,
      locale: verified.session.locale ?? resolveLocale(request.headers),
      timezone: verified.session.timezone ?? resolveTimezone(request.headers),
      ...(verified.session.provider ? { authProvider: verified.session.provider } : {}),
      ...(verified.session.subject ? { authSubject: verified.session.subject } : {})
    };
  };

  const handleAsync = async (request: ApiHttpRequest): Promise<ApiHttpResponse> => {
    const authContext = await resolveAsyncAuthContext(request);

    if (isHttpResponse(authContext)) {
      return authContext;
    }

    const [version, resource, id, action, nestedAction] = parsePath(request.path);

    if (version !== "v1") {
      return notFound();
    }

    if (request.method === "POST" && resource === "photos" && id === "upload-url" && !action) {
      return resultToHttpResponseAsync(service.issuePhotoUploadUrlWithStorageSigner(authContext, request.body as PhotoUploadUrlRequest));
    }

    if (request.method === "GET" && resource === "assets" && id && action === "signed-url" && !nestedAction) {
      return resultToHttpResponseAsync(service.issueGeneratedAssetReadUrlWithStorageSigner(authContext, id));
    }

    if (request.method === "POST" && resource === "commerce" && id === "purchases" && action === "verify" && !nestedAction) {
      return resultToHttpResponseAsync(service.verifyPurchaseWithStoreVerifier(authContext, request.body as PurchaseVerificationRequest));
    }

    if (request.method === "POST" && resource === "commerce" && id === "restore" && !action) {
      return resultToHttpResponseAsync(service.restorePurchasesWithStoreVerifier(authContext, request.body as RestorePurchasesRequest));
    }

    if (request.method === "POST" && resource === "commerce" && id === "store-webhooks" && !action) {
      return routeCommerceStoreWebhook(request, resultToHttpResponseAsync, async (response) => response);
    }

    if (request.method === "POST" && resource === "commerce" && id === "purchases" && action === "revoke" && !nestedAction) {
      const webhookError = verifyCommerceWebhook(request);

      if (webhookError) {
        return webhookError;
      }

      return resultToHttpResponseAsync(service.revokePurchase(request.body as PurchaseRevocationRequest));
    }

    return handleWithAuthContextAsync(request, authContext);
  };

  return {
    service,
    handle,
    handleAsync
  };
}
