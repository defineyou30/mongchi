import { describe, expect, it, vi } from "vitest";

vi.mock("../../shared/errors/reporter", () => ({
  reporter: { captureMessage: vi.fn() }
}));

import {
  getAccountIdentitySummary,
  linkAppleIdentity,
  recoverWithAppleIdentity
} from "./supabaseAccountLinkSession";
import { reporter } from "../../shared/errors/reporter";

const appleCredential = { identityToken: "id-token-1", rawNonce: "raw-nonce-1" };

describe("linkAppleIdentity", () => {
  it("links the Apple identity to the current session and resolves ok", async () => {
    const linkIdentity = vi.fn(async () => ({ data: { user: {}, session: {} }, error: null }));
    const client = { auth: { linkIdentity } } as never;

    const result = await linkAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: true });
    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "apple",
      token: "id-token-1",
      nonce: "raw-nonce-1"
    });
  });

  it("maps identity_already_exists to identity_already_linked", async () => {
    const linkIdentity = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "identity_already_exists", message: "already linked" }
    }));
    const client = { auth: { linkIdentity } } as never;

    const result = await linkAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "identity_already_linked" });
  });

  it("maps manual_linking_disabled to linking_disabled", async () => {
    const linkIdentity = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "manual_linking_disabled", message: "disabled" }
    }));
    const client = { auth: { linkIdentity } } as never;

    const result = await linkAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "linking_disabled" });
  });

  it("maps an unrecognized error code to request_failed", async () => {
    const linkIdentity = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "unexpected_failure", message: "boom" }
    }));
    const client = { auth: { linkIdentity } } as never;

    const result = await linkAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("never throws when the client itself throws, and reports the failure", async () => {
    const linkIdentity = vi.fn(async () => {
      throw new Error("offline");
    });
    const client = { auth: { linkIdentity } } as never;

    const result = await linkAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });
});

describe("recoverWithAppleIdentity", () => {
  it("signs in as the Apple identity's owning user and returns its id", async () => {
    const signInWithIdToken = vi.fn(async () => ({
      data: { user: { id: "user-1" }, session: { user: { id: "user-1" } } },
      error: null
    }));
    const client = { auth: { signInWithIdToken } } as never;

    const result = await recoverWithAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: true, userId: "user-1" });
    expect(signInWithIdToken).toHaveBeenCalledWith({
      provider: "apple",
      token: "id-token-1",
      nonce: "raw-nonce-1"
    });
  });

  it("resolves request_failed when the sign-in errors", async () => {
    const signInWithIdToken = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { code: "bad_jwt", message: "invalid token" }
    }));
    const client = { auth: { signInWithIdToken } } as never;

    const result = await recoverWithAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
  });

  it("never throws when the client itself throws, and reports the failure", async () => {
    const signInWithIdToken = vi.fn(async () => {
      throw new Error("offline");
    });
    const client = { auth: { signInWithIdToken } } as never;

    const result = await recoverWithAppleIdentity(client, appleCredential);

    expect(result).toEqual({ ok: false, reason: "request_failed" });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });
});

describe("getAccountIdentitySummary", () => {
  it("reports linked with the Apple identity's email when present", async () => {
    const getSession = vi.fn(async () => ({ data: { session: { user: { id: "user-1", is_anonymous: false } } } }));
    const getUserIdentities = vi.fn(async () => ({
      data: { identities: [{ provider: "apple", identity_data: { email: "friend@example.com" } }] },
      error: null
    }));
    const client = { auth: { getSession, getUserIdentities } } as never;

    const result = await getAccountIdentitySummary(client);

    expect(result).toEqual({ linked: true, provider: "apple", email: "friend@example.com" });
  });

  it("reports unlinked for an anonymous session without calling getUserIdentities", async () => {
    const getSession = vi.fn(async () => ({ data: { session: { user: { id: "anon-1", is_anonymous: true } } } }));
    const getUserIdentities = vi.fn();
    const client = { auth: { getSession, getUserIdentities } } as never;

    const result = await getAccountIdentitySummary(client);

    expect(result).toEqual({ linked: false });
    expect(getUserIdentities).not.toHaveBeenCalled();
  });

  it("reports unlinked when there is no session at all", async () => {
    const getSession = vi.fn(async () => ({ data: { session: null } }));
    const getUserIdentities = vi.fn();
    const client = { auth: { getSession, getUserIdentities } } as never;

    const result = await getAccountIdentitySummary(client);

    expect(result).toEqual({ linked: false });
  });

  it("reports unlinked when the user has no Apple identity", async () => {
    const getSession = vi.fn(async () => ({ data: { session: { user: { id: "user-1", is_anonymous: false } } } }));
    const getUserIdentities = vi.fn(async () => ({
      data: { identities: [{ provider: "email", identity_data: {} }] },
      error: null
    }));
    const client = { auth: { getSession, getUserIdentities } } as never;

    const result = await getAccountIdentitySummary(client);

    expect(result).toEqual({ linked: false });
  });

  it("never throws when the client itself throws, and reports unlinked", async () => {
    const getSession = vi.fn(async () => {
      throw new Error("offline");
    });
    const client = { auth: { getSession } } as never;

    const result = await getAccountIdentitySummary(client);

    expect(result).toEqual({ linked: false });
    expect(reporter.captureMessage).toHaveBeenCalled();
  });
});
