import { describe, expect, it } from "vitest";

import { scrubAnonymousUserId, scrubBreadcrumbMessage, scrubDataRecord } from "./sentryScrubbing";

describe("scrubAnonymousUserId", () => {
  it("keeps only the first 8 characters of an anonymous id", () => {
    expect(scrubAnonymousUserId("abcdef0123456789")).toBe("abcdef01");
  });

  it("returns the id unchanged when it is already 8 characters or shorter", () => {
    expect(scrubAnonymousUserId("abcd")).toBe("abcd");
    expect(scrubAnonymousUserId("abcdefgh")).toBe("abcdefgh");
  });

  it("returns undefined for a missing id", () => {
    expect(scrubAnonymousUserId(null)).toBeUndefined();
    expect(scrubAnonymousUserId(undefined)).toBeUndefined();
    expect(scrubAnonymousUserId("")).toBeUndefined();
  });
});

describe("scrubDataRecord", () => {
  it("redacts the whole value for a key matching uri/photo/message/text, case-insensitively", () => {
    expect(
      scrubDataRecord({
        photoUri: "file:///private/pet.jpg",
        messageText: "hey there",
        chatMessage: "hello",
        userText: 42,
        SomeURI: "https://example.com/whatever"
      })
    ).toEqual({
      photoUri: "[redacted]",
      messageText: "[redacted]",
      chatMessage: "[redacted]",
      userText: "[redacted]",
      SomeURI: "[redacted]"
    });
  });

  it("redacts a file:// string found under an innocuous key, without touching the rest of the record", () => {
    expect(
      scrubDataRecord({
        localPath: "file:///private/var/mobile/tmp/upload.jpg",
        screen: "GenerationScreen",
        attempt: 2
      })
    ).toEqual({
      localPath: "[redacted]",
      screen: "GenerationScreen",
      attempt: 2
    });
  });

  it("passes through ordinary values untouched", () => {
    expect(scrubDataRecord({ screen: "ChatGateScreen", retryCount: 3, isFatal: false })).toEqual({
      screen: "ChatGateScreen",
      retryCount: 3,
      isFatal: false
    });
  });

  it("recurses into nested objects and arrays", () => {
    expect(
      scrubDataRecord({
        details: { photoUri: "file:///a.jpg", screen: "Home" },
        paths: ["file:///a.jpg", "not-a-path"]
      })
    ).toEqual({
      details: { photoUri: "[redacted]", screen: "Home" },
      paths: ["[redacted]", "not-a-path"]
    });
  });
});

describe("scrubBreadcrumbMessage", () => {
  it("redacts a file:// uri inside a console breadcrumb's message", () => {
    expect(scrubBreadcrumbMessage("Uploading file:///private/pet.jpg now")).toBe("[redacted]");
  });

  it("leaves an ordinary message untouched", () => {
    expect(scrubBreadcrumbMessage("chat: turn timing")).toBe("chat: turn timing");
  });

  it("passes undefined through unchanged", () => {
    expect(scrubBreadcrumbMessage(undefined)).toBeUndefined();
  });
});
