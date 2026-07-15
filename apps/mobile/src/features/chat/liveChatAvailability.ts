declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export const parseLiveChatAvailability = (value: string | undefined): boolean => value?.trim().toLowerCase() === "true";

export const isLiveChatEnabled = (): boolean =>
  parseLiveChatAvailability(typeof process === "undefined" ? undefined : process.env?.EXPO_PUBLIC_TINY_PET_LIVE_CHAT_ENABLED);
