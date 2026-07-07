import { createSafeAnalyticsEvent } from "@mongchi/shared";
import type { SafeAnalyticsEventName, SafeAnalyticsProperties } from "@mongchi/shared";

export const recordMobileEvent = (
  name: SafeAnalyticsEventName,
  properties: SafeAnalyticsProperties = {}
) => {
  const event = createSafeAnalyticsEvent(name, properties);

  return event;
};
