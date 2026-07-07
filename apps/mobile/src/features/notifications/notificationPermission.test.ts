import { beforeEach, describe, expect, it, vi } from "vitest";

const getPermissionsAsync = vi.fn();
const requestPermissionsAsync = vi.fn();
const setNotificationChannelAsync = vi.fn();

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => getPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => requestPermissionsAsync(...args),
  setNotificationChannelAsync: (...args: unknown[]) => setNotificationChannelAsync(...args),
  AndroidImportance: {
    DEFAULT: 3
  }
}));

vi.mock("react-native", () => ({
  Platform: {
    OS: "ios"
  }
}));

import { requestNotificationPermissionAfterFirstCareAction } from "./notificationPermission";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requestNotificationPermissionAfterFirstCareAction", () => {
  it("is a no-op and reports granted when permission is already granted", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    const result = await requestNotificationPermissionAfterFirstCareAction();

    expect(result).toEqual({ status: "granted" });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("is a no-op and does not re-prompt when the user already permanently denied", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "denied", granted: false, canAskAgain: false });

    const result = await requestNotificationPermissionAfterFirstCareAction();

    expect(result).toEqual({ status: "denied" });
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permission when status is undetermined", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });
    requestPermissionsAsync.mockResolvedValue({ status: "granted", granted: true, canAskAgain: true });

    const result = await requestNotificationPermissionAfterFirstCareAction();

    expect(requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: "granted" });
  });

  it("reports denied when the user declines the prompt", async () => {
    getPermissionsAsync.mockResolvedValue({ status: "undetermined", granted: false, canAskAgain: true });
    requestPermissionsAsync.mockResolvedValue({ status: "denied", granted: false, canAskAgain: false });

    const result = await requestNotificationPermissionAfterFirstCareAction();

    expect(result).toEqual({ status: "denied" });
  });
});
