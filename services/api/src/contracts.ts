import type {
  CareActionRequest,
  CareActionReward,
  CareState,
  Conversation,
  ConversationMessage,
  CreditWallet,
  CreditWalletSpendBreakdown,
  Entitlement,
  EntitlementKey,
  GeneratedAsset,
  GeneratedAssetId,
  GenerationIssueCategory,
  GenerationJob,
  GenerationJobId,
  ISODateTime,
  Inventory,
  Item,
  ItemId,
  Locale,
  PetId,
  PetProfile,
  PhotoId,
  ReactionRule,
  RelationshipState,
  SelectedReaction,
  UserId,
  WalkSession,
  WalkSessionId
} from "@mongchi/shared";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  authRequired: boolean;
  notes: string;
}

export const apiEndpoints: ApiEndpoint[] = [
  { method: "GET", path: "/v1/me", authRequired: true, notes: "Resolve current user and onboarding state." },
  { method: "GET", path: "/v1/pets", authRequired: true, notes: "List pets owned by the current user." },
  { method: "POST", path: "/v1/pets", authRequired: true, notes: "Create pet profile draft before generation." },
  { method: "PATCH", path: "/v1/pets/:petId", authRequired: true, notes: "Update pet name, personality, talking style, or memory note." },
  { method: "DELETE", path: "/v1/pets/:petId", authRequired: true, notes: "Delete/archive pet and owned generated assets." },
  { method: "POST", path: "/v1/photos/upload-url", authRequired: true, notes: "Issue short-lived signed upload URL." },
  { method: "POST", path: "/v1/photos/complete-upload", authRequired: true, notes: "Validate uploaded photo metadata." },
  { method: "POST", path: "/v1/generation-jobs", authRequired: true, notes: "Create async generation job." },
  { method: "GET", path: "/v1/generation-jobs/:jobId", authRequired: true, notes: "Read generation job state." },
  { method: "POST", path: "/v1/generation-jobs/:jobId/poll", authRequired: true, notes: "Advance/read mock generation job lifecycle for integration builds." },
  { method: "POST", path: "/v1/generation-jobs/:jobId/retry", authRequired: true, notes: "Retry without consuming paid value for system failures." },
  { method: "POST", path: "/v1/generation-jobs/:jobId/accept", authRequired: true, notes: "Accept generated assets and activate pet." },
  { method: "POST", path: "/v1/generation-issue-reports", authRequired: true, notes: "Submit category-only generated pet issue report." },
  { method: "GET", path: "/v1/pets/:petId/assets", authRequired: true, notes: "Return signed app-private generated asset URLs." },
  { method: "GET", path: "/v1/assets/:assetId/signed-url", authRequired: true, notes: "Issue short-lived app-private generated asset read URL." },
  { method: "GET", path: "/v1/pets/:petId/care-state", authRequired: true, notes: "Read current care state." },
  { method: "GET", path: "/v1/pets/:petId/relationship-state", authRequired: true, notes: "Read current bond and relationship state." },
  { method: "POST", path: "/v1/pets/:petId/care-actions", authRequired: true, notes: "Process care action and optional reward." },
  { method: "POST", path: "/v1/pets/:petId/walks", authRequired: true, notes: "Start idle walk session." },
  { method: "POST", path: "/v1/walks/:walkId/claim", authRequired: true, notes: "Claim returned walk reward once." },
  { method: "POST", path: "/v1/weather/current", authRequired: true, notes: "Resolve cached weather from approximate location only." },
  { method: "GET", path: "/v1/reaction-catalog", authRequired: true, notes: "Fetch authored reaction rules by locale/version." },
  { method: "POST", path: "/v1/conversations", authRequired: true, notes: "Create premium chat conversation after entitlement check." },
  { method: "GET", path: "/v1/conversations/:id", authRequired: true, notes: "Read owned conversation and stored messages." },
  { method: "POST", path: "/v1/conversations/:id/messages", authRequired: true, notes: "Backend-only AI chat gateway with moderation." },
  { method: "DELETE", path: "/v1/conversations/:id", authRequired: true, notes: "Delete one owned conversation and its messages." },
  { method: "GET", path: "/v1/catalog/items", authRequired: true, notes: "Return visible item/theme catalog." },
  { method: "GET", path: "/v1/inventory", authRequired: true, notes: "Return owned items and placement." },
  { method: "POST", path: "/v1/inventory/purchases", authRequired: true, notes: "Spend app credits to buy one catalog item." },
  { method: "POST", path: "/v1/inventory/placements", authRequired: true, notes: "Place one owned item into the terrarium layout." },
  { method: "DELETE", path: "/v1/inventory/placements/:itemId", authRequired: true, notes: "Remove one owned item from the terrarium layout." },
  { method: "GET", path: "/v1/commerce/products", authRequired: true, notes: "Return server-owned purchasable product catalog." },
  { method: "POST", path: "/v1/commerce/purchases/verify", authRequired: true, notes: "Server verifies purchase and writes entitlement ledger." },
  { method: "POST", path: "/v1/commerce/store-webhooks", authRequired: false, notes: "Server-only App Store / Google Play notification ingress." },
  { method: "POST", path: "/v1/commerce/purchases/revoke", authRequired: false, notes: "Server-only store webhook revokes purchase entitlement." },
  { method: "POST", path: "/v1/commerce/restore", authRequired: true, notes: "Restore purchases through server verification." },
  { method: "GET", path: "/v1/entitlements", authRequired: true, notes: "Return entitlements owned by the current user." },
  { method: "DELETE", path: "/v1/privacy/original-photos", authRequired: true, notes: "Delete original source photos independently from generated pet." },
  { method: "DELETE", path: "/v1/privacy/chat-history", authRequired: true, notes: "Delete stored conversation history." },
  { method: "DELETE", path: "/v1/privacy/pet/:petId", authRequired: true, notes: "Delete pet and associated private generated assets." }
];

export type { WeatherLookupRequest, WeatherLookupResponse } from "@mongchi/shared";

export interface CurrentUserResponse {
  userId: UserId;
  locale: Locale;
  timezone: string;
  onboardingState: "new" | "pet_created" | "generation_started" | "pet_active";
  wallet: CreditWallet;
}

export interface CreatePetRequest {
  name: string;
  species: PetProfile["species"];
  personalityTags: PetProfile["personalityTags"];
  talkingStyle: PetProfile["talkingStyle"];
  favoriteThing?: string;
}

export interface UpdatePetRequest {
  name?: string;
  personalityTags?: PetProfile["personalityTags"];
  talkingStyle?: PetProfile["talkingStyle"];
  favoriteThing?: string;
  memoryNote?: string;
}

export interface ListPetsResponse {
  pets: PetProfile[];
}

export interface DeletePetResponse {
  deletedPetId: PetId;
  deletedAt: string;
}

export interface DeleteOriginalPhotosRequest {
  petId: PetId;
}

export interface DeleteOriginalPhotosResponse {
  deletedPhotoIds: PhotoId[];
  deletedAt: string;
}

export interface DeleteChatHistoryResponse {
  deletedConversationIds: string[];
  deletedMessageIds: string[];
  deletedAt: string;
}

export interface PhotoUploadUrlRequest {
  petId: PetId;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
}

export interface PhotoUploadUrlResponse {
  photoId: PhotoId;
  uploadUrl: string;
  uploadMethod: "PUT" | "POST";
  uploadHeaders: Record<string, string>;
  expiresAt: string;
  maxByteSize: number;
}

export interface CompletePhotoUploadRequest {
  photoId: PhotoId;
  contentHash: string;
}

export interface CreateGenerationJobRequest {
  petId: PetId;
  sourcePhotoIds: PhotoId[];
  optionalPhotoIds: PhotoId[];
}

export interface CompleteGenerationJobAssetInput {
  id?: GeneratedAssetId;
  state: GeneratedAsset["state"];
  uri: string;
  thumbnailUri?: string;
  width: number;
  height: number;
  contentHash: string;
  mimeType: GeneratedAsset["mimeType"];
  storageClass?: GeneratedAsset["storageClass"];
  version?: number;
  qualityStatus?: GeneratedAsset["qualityStatus"];
}

export interface CompleteGenerationJobRequest {
  jobId: GenerationJobId;
  provider?: GenerationJob["provider"];
  costUnits?: number;
  quality?: GenerationJob["quality"];
  assets: CompleteGenerationJobAssetInput[];
  completedAt?: ISODateTime;
}

export interface AcceptGenerationJobRequest {
  jobId: GenerationJobId;
  acceptedAssetIds: string[];
}

export interface GenerationIssueReportRequest {
  petId: PetId;
  generationJobId?: GenerationJobId;
  category: GenerationIssueCategory;
}

export interface GenerationIssueReportResponse {
  reportId: string;
  petId: PetId;
  generationJobId?: GenerationJobId;
  category: GenerationIssueCategory;
  reportedAt: ISODateTime;
}

export interface RetryGenerationJobResponse {
  job: GenerationJob;
}

export interface GenerationPollResponse {
  job: GenerationJob;
  assets: GeneratedAsset[];
}

export interface CompleteGenerationJobResponse {
  job: GenerationJob;
  assets: GeneratedAsset[];
}

export interface AcceptGenerationJobResponse {
  pet: PetProfile;
  assets: GeneratedAsset[];
}

export interface CareActionResponse {
  careState: CareState;
  relationshipState: RelationshipState;
  inventory: Inventory | null;
  wallet?: CreditWallet;
  reaction: SelectedReaction | null;
  reward: CareActionReward | null;
}

export interface StartWalkResponse {
  walk: WalkSession;
  careState: CareState;
  relationshipState: RelationshipState;
  reaction: SelectedReaction | null;
}

export interface ClaimWalkRequest {
  walkId: WalkSessionId;
}

export interface ClaimWalkResponse {
  walk: WalkSession;
  inventory: Inventory;
  relationshipState: RelationshipState;
  reaction: SelectedReaction | null;
}

export interface PlaceInventoryItemRequest {
  itemId: ItemId;
}

export interface InventoryPlacementResponse {
  inventory: Inventory;
}

export interface PurchaseInventoryItemRequest {
  itemId: ItemId;
}

export interface PurchaseInventoryItemResponse {
  item: Item;
  inventory: Inventory;
  wallet: CreditWallet;
  walletSpend: CreditWalletSpendBreakdown;
  creditCost: number;
}

export interface ReactionCatalogResponse {
  locale: Locale;
  version: string;
  rules: ReactionRule[];
}

export interface ItemCatalogResponse {
  items: Item[];
}

export interface PetAssetsResponse {
  assets: GeneratedAsset[];
}

export interface GeneratedAssetSignedUrlResponse {
  assetId: GeneratedAssetId;
  petId: PetId;
  signedUrl: string;
  expiresAt: string;
  contentType: GeneratedAsset["mimeType"];
  storageClass: GeneratedAsset["storageClass"];
}

export interface PurchaseVerificationResponse {
  entitlements: Entitlement[];
  wallet?: CreditWallet;
  serverVerified: true;
}

export interface PurchaseVerificationRequest {
  platform: "ios" | "android";
  productId: string;
  transactionId: string;
  receiptHash: string;
  storeVerificationToken?: string;
}

export interface RestorePurchaseRequestItem {
  productId: string;
  transactionId: string;
  receiptHash: string;
  storeVerificationToken: string;
}

export interface RestorePurchasesRequest {
  platform: "ios" | "android";
  transactionIds: string[];
  purchases?: RestorePurchaseRequestItem[];
}

export interface PurchaseRevocationRequest {
  platform: "ios" | "android";
  transactionId: string;
  reason: "refund" | "chargeback" | "developer_revoke" | "store_revoke";
}

export interface PurchaseReceiptRevocationRequest {
  platform: "ios" | "android";
  receiptHash: string;
  reason: PurchaseRevocationRequest["reason"];
  productId?: string;
}

export interface PurchaseRevocationResponse {
  entitlement: Entitlement;
  revoked: true;
}

export interface CommerceProduct {
  productId: string;
  entitlementKey: EntitlementKey;
  grantType: "durable" | "consumable" | "subscription";
}

export interface CommerceProductsResponse {
  products: CommerceProduct[];
}

export interface EntitlementsResponse {
  entitlements: Entitlement[];
}

export interface CreateConversationRequest {
  petId: PetId;
  disclosureAccepted: boolean;
}

export interface CreateConversationResponse {
  conversation: Conversation;
  disclosureText: string;
}

export interface ConversationThreadResponse {
  conversation: Conversation;
  messages: ConversationMessage[];
}

export interface DeleteConversationResponse {
  deletedConversationId: string;
  deletedMessageIds: string[];
  deletedAt: string;
}

export interface SendConversationMessageRequest {
  conversationId: string;
  text: string;
}

export interface SendConversationMessageResponse {
  userMessage: ConversationMessage;
  petMessage: ConversationMessage;
  safetyFlags: string[];
  wallet: CreditWallet;
  walletSpend: CreditWalletSpendBreakdown;
}

export interface ApiContractSurface {
  currentUser: CurrentUserResponse;
  pet: PetProfile;
  generationJob: GenerationJob;
  generationIssueReport: GenerationIssueReportResponse;
  careActionRequest: CareActionRequest;
  careActionResponse: CareActionResponse;
}
