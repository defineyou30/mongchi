import type { AuditTimestamps, ConversationId, ISODateTime, PetId, UserId } from "./common";

export type ConversationType = "premium_ai_chat" | "support";
export type ConversationStatus = "open" | "archived" | "deleted";
export type ConversationSender = "user" | "pet_ai" | "system";

export interface Conversation extends AuditTimestamps {
  id: ConversationId;
  userId: UserId;
  petId: PetId;
  type: ConversationType;
  status: ConversationStatus;
  disclosureAcceptedAt?: ISODateTime;
  deletedAt?: ISODateTime;
}

export interface ConversationMessage {
  id: string;
  conversationId: ConversationId;
  sender: ConversationSender;
  text: string;
  safetyFlags: string[];
  createdAt: ISODateTime;
}

export interface MemoryNote {
  id: string;
  petId: PetId;
  text: string;
  approvedByUser: boolean;
  createdAt: ISODateTime;
}

export interface PremiumChatGate {
  requiredEntitlement: "premium_chat";
  disclosureText: string;
}
