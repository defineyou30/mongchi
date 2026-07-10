export const NOTIFICATION_PAYLOAD_VERSION = 1 as const;
export const MAX_NOTIFICATION_PAYLOAD_BYTES = 256;
export const MAX_NOTIFICATION_OWNER_LENGTH = 16;
export const MAX_NOTIFICATION_KEY_LENGTH = 64;
export const MAX_NOTIFICATION_ACTION_LENGTH = 32;

export interface BoundedNotificationPayloadFields {
  owner: string;
  key: string;
  action: string;
}

const canonicalPayloadKeys = [
  "mongchiNotificationAction",
  "mongchiNotificationKey",
  "mongchiNotificationOwner",
  "mongchiNotificationVersion"
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getUtf8ByteLength = (value: string): number => {
  let length = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit <= 0x7f) {
      length += 1;
    } else if (codeUnit <= 0x7ff) {
      length += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff && index + 1 < value.length) {
      const nextCodeUnit = value.charCodeAt(index + 1);

      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
        length += 4;
        index += 1;
      } else {
        length += 3;
      }
    } else {
      length += 3;
    }
  }

  return length;
};

const readCanonicalRecord = (value: Record<string, unknown>): Record<string, unknown> | null => {
  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }

  const ownKeys = Reflect.ownKeys(value).sort((left, right) => String(left).localeCompare(String(right)));

  if (
    ownKeys.length !== canonicalPayloadKeys.length ||
    ownKeys.some((key, index) => key !== canonicalPayloadKeys[index])
  ) {
    return null;
  }

  const record: Record<string, unknown> = {};

  for (const key of canonicalPayloadKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (!descriptor || !("value" in descriptor)) {
      return null;
    }

    record[key] = descriptor.value;
  }

  return record;
};

export const parseBoundedNotificationPayloadFields = (
  value: unknown
): BoundedNotificationPayloadFields | null => {
  try {
    if (!isRecord(value)) {
      return null;
    }

    const record = readCanonicalRecord(value);

    if (!record || record.mongchiNotificationVersion !== NOTIFICATION_PAYLOAD_VERSION) {
      return null;
    }

    const owner = record.mongchiNotificationOwner;
    const key = record.mongchiNotificationKey;
    const action = record.mongchiNotificationAction;

    if (
      typeof owner !== "string" ||
      typeof key !== "string" ||
      typeof action !== "string" ||
      owner.length > MAX_NOTIFICATION_OWNER_LENGTH ||
      key.length > MAX_NOTIFICATION_KEY_LENGTH ||
      action.length > MAX_NOTIFICATION_ACTION_LENGTH
    ) {
      return null;
    }

    const serialized = JSON.stringify(record);

    return getUtf8ByteLength(serialized) <= MAX_NOTIFICATION_PAYLOAD_BYTES
      ? { owner, key, action }
      : null;
  } catch {
    return null;
  }
};
