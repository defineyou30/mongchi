import type { ConversationId, Locale, PetId } from "@mongchi/shared";

export type PremiumChatMonitorLevel = "info" | "error";

export interface PremiumChatMonitor {
  info?: (event: string, metadata: PremiumChatMonitorMetadata) => void;
  error?: (event: string, metadata: PremiumChatMonitorMetadata) => void;
}

export interface PremiumChatMonitorMetadata {
  conversationId: ConversationId;
  petId: PetId;
  locale: Locale;
  recentMessageCount: number;
  inputSafetyFlags: readonly string[];
  outputSafetyFlags?: readonly string[];
  providerOutputModerated?: boolean;
  failureCode?: string;
  failureStatus?: number;
}

export const emitPremiumChatMonitorEvent = (
  monitor: PremiumChatMonitor | undefined,
  level: PremiumChatMonitorLevel,
  event: string,
  metadata: PremiumChatMonitorMetadata
) => {
  try {
    monitor?.[level]?.(event, metadata);
  } catch {
    // Monitoring must never block premium chat progress.
  }
};
