import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

/**
 * Account recovery stack, package B: the native "Sign in with Apple" prompt.
 * Produces the raw nonce/identity-token pair that
 * supabaseAccountLinkSession.ts's linkAppleIdentity/recoverWithAppleIdentity
 * hand to supabase-js -- Apple only ever sees the *hashed* nonce (so a
 * captured identityToken can't be replayed against a different nonce), while
 * Supabase verifies the identityToken's nonce claim against the *raw* value
 * this module hands back. Deliberately never throws: every rejection
 * AppleAuthentication.signInAsync can produce (user cancel, no Apple ID
 * configured, network hiccup talking to Apple) is folded into a typed
 * `{ ok: false, reason }`, mirroring supabaseAccountDeletion.ts's shape so
 * callers only ever branch on `ok`.
 */

export type RequestAppleCredentialResult =
  | { readonly ok: true; readonly identityToken: string; readonly rawNonce: string }
  | { readonly ok: false; readonly reason: "unavailable" }
  | { readonly ok: false; readonly reason: "canceled" }
  | { readonly ok: false; readonly reason: "failed" };

const isCanceledError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED";

/**
 * Requests an Apple identity credential for this device, guarded by
 * `isAvailableAsync` (Apple Sign In is iOS-only and requires an OS version
 * that supports it). Returns the raw (unhashed) nonce alongside the identity
 * token -- see this module's header comment for why both are needed.
 */
export const requestAppleCredential = async (): Promise<RequestAppleCredentialResult> => {
  try {
    const available = await AppleAuthentication.isAvailableAsync();

    if (!available) {
      return { ok: false, reason: "unavailable" };
    }

    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ],
      nonce: hashedNonce
    });

    if (!credential.identityToken) {
      return { ok: false, reason: "failed" };
    }

    return { ok: true, identityToken: credential.identityToken, rawNonce };
  } catch (error) {
    if (isCanceledError(error)) {
      return { ok: false, reason: "canceled" };
    }

    return { ok: false, reason: "failed" };
  }
};
