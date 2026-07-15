import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "../../shared/api/requestTimeout";
import { reporter } from "../../shared/errors/reporter";

/**
 * Account recovery stack, package B: linking/recovering an Apple identity
 * against a Supabase auth user. Two distinct flows share the same
 * identityToken/rawNonce credential (see appleAuthSession.ts's
 * requestAppleCredential):
 *
 *   - linkAppleIdentity promotes the *current* (anonymous) session to carry
 *     an Apple identity, preserving auth.uid() -- supabase-js's
 *     auth.linkIdentity({provider, token, nonce}) overload detects the
 *     `token` field and takes the id-token path (GoTrueClient's
 *     linkIdentityIdToken), which reads the current session's access_token
 *     itself and sends `link_identity: true` server-side. Callers do not
 *     need to (and should not try to) thread the access token through by
 *     hand.
 *   - recoverWithAppleIdentity is for a fresh device/reinstall with no
 *     existing local session to preserve: auth.signInWithIdToken replaces
 *     whatever session is active with the session belonging to the Apple
 *     identity's owning user.
 *
 * Both never throw -- same try/catch shield as supabaseAccountDeletion.ts
 * and supabaseSupportSession.ts, so a thrown client-library exception (e.g.
 * a network failure) becomes a retryable `request_failed` result instead of
 * an unhandled rejection.
 */

export interface AppleIdentityCredential {
  readonly identityToken: string;
  readonly rawNonce: string;
}

export type LinkAppleIdentityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "identity_already_linked" }
  | { readonly ok: false; readonly reason: "linking_disabled" }
  | { readonly ok: false; readonly reason: "request_failed" };

const accountLinkTimeoutMs = 20_000;

/**
 * Maps supabase-js's AuthError.code from a failed link attempt onto this
 * module's typed reasons. `identity_already_exists` means the Apple identity
 * is already linked to a *different* Supabase user (Supabase's own
 * uniqueness constraint on provider identities) -- not that this device's
 * own identity is already linked, which would simply not error.
 * `manual_linking_disabled` means the project dashboard's "Allow manual
 * linking" switch is off. Anything else collapses to the generic retryable
 * `request_failed`.
 */
const mapLinkErrorCode = (code: string | undefined): LinkAppleIdentityResult => {
  if (code === "identity_already_exists") {
    return { ok: false, reason: "identity_already_linked" };
  }

  if (code === "manual_linking_disabled") {
    return { ok: false, reason: "linking_disabled" };
  }

  return { ok: false, reason: "request_failed" };
};

export const linkAppleIdentity = async (
  client: SupabaseClient,
  credential: AppleIdentityCredential
): Promise<LinkAppleIdentityResult> => {
  try {
    const linked = await withRequestTimeout(
      client.auth.linkIdentity({
        provider: "apple",
        token: credential.identityToken,
        nonce: credential.rawNonce
      }),
      accountLinkTimeoutMs
    );

    if (linked.error) {
      return mapLinkErrorCode(linked.error.code);
    }

    return { ok: true };
  } catch (cause) {
    reporter.captureMessage("account: apple identity link threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, reason: "request_failed" };
  }
};

export type RecoverWithAppleIdentityResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: "request_failed" };

/**
 * Signs this device into the Supabase user that owns the given Apple
 * identity, replacing any session currently held (see this module's header
 * comment for why this is the "recover on a new device" path rather than
 * linkAppleIdentity's "promote this session" path).
 */
export const recoverWithAppleIdentity = async (
  client: SupabaseClient,
  credential: AppleIdentityCredential
): Promise<RecoverWithAppleIdentityResult> => {
  try {
    const signedIn = await withRequestTimeout(
      client.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: credential.rawNonce
      }),
      accountLinkTimeoutMs
    );

    const userId = signedIn.data.session?.user.id ?? signedIn.data.user?.id;

    if (signedIn.error || !userId) {
      return { ok: false, reason: "request_failed" };
    }

    return { ok: true, userId };
  } catch (cause) {
    reporter.captureMessage("account: apple identity recovery threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return { ok: false, reason: "request_failed" };
  }
};

export interface AccountIdentitySummary {
  readonly linked: boolean;
  readonly provider?: "apple";
  readonly email?: string | null;
}

const unlinkedSummary: AccountIdentitySummary = { linked: false };

/**
 * Best-effort read of whether the current device's Supabase session has
 * already promoted an Apple identity -- used to decide whether Settings
 * should offer "Link Apple ID" vs. show it as already linked. Anonymous
 * sessions (is_anonymous, or no session at all) are always reported as
 * unlinked without an extra round-trip, since getUserIdentities() requires a
 * signed-in user. Any failure along the way (expired session, network
 * error, thrown client exception) resolves to the same unlinked summary
 * rather than throwing -- this is a read for UI display, never a gate on a
 * write.
 */
export const getAccountIdentitySummary = async (client: SupabaseClient): Promise<AccountIdentitySummary> => {
  try {
    const session = await withRequestTimeout(client.auth.getSession(), accountLinkTimeoutMs);
    const user = session.data.session?.user;

    if (!user || user.is_anonymous) {
      return unlinkedSummary;
    }

    const identities = await withRequestTimeout(client.auth.getUserIdentities(), accountLinkTimeoutMs);

    if (identities.error || !identities.data) {
      return unlinkedSummary;
    }

    const appleIdentity = identities.data.identities.find((identity) => identity.provider === "apple");

    if (!appleIdentity) {
      return unlinkedSummary;
    }

    const email = typeof appleIdentity.identity_data?.email === "string" ? appleIdentity.identity_data.email : null;

    return { linked: true, provider: "apple", email };
  } catch (cause) {
    reporter.captureMessage("account: identity summary fetch threw", {
      cause: cause instanceof Error ? cause.message : String(cause)
    });
    return unlinkedSummary;
  }
};
