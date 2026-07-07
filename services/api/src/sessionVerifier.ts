import type { Locale, UserId } from "@mongchi/shared";

export type ApiSessionVerificationStatus = 401 | 403 | 503;

export interface ApiSessionVerificationError {
  status: ApiSessionVerificationStatus;
  code: string;
  messageSafe: string;
}

export interface ApiSessionVerifierInput {
  token: string;
  authorizationHeader: string;
  locale: Locale;
  timezone: string;
}

export interface VerifiedApiSession {
  userId: UserId;
  locale?: Locale;
  timezone?: string;
  provider?: string;
  subject?: string;
}

export type ApiSessionVerificationResult =
  | {
      ok: true;
      session: VerifiedApiSession;
    }
  | {
      ok: false;
      error: ApiSessionVerificationError;
    };

export interface ApiSessionVerifier {
  verifySession: (input: ApiSessionVerifierInput) => Promise<ApiSessionVerificationResult>;
}
