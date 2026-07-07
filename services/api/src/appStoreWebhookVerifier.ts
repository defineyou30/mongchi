import { createHash, verify, X509Certificate } from "node:crypto";

export interface AppStoreJwsVerificationInput {
  jws: string;
  purpose: "notification" | "transaction";
}

export interface AppStoreJwsVerifier {
  verifyAppStoreJws(input: AppStoreJwsVerificationInput): boolean;
}

export interface AppStoreNotificationJwsVerifierOptions {
  trustedRootCertificateSha256Fingerprints: readonly string[];
  now?: () => Date;
}

const base64UrlSegmentPattern = /^[A-Za-z0-9_-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeString = (value: unknown): string | null => (typeof value === "string" ? value.trim() || null : null);

const decodeBase64UrlJson = (value: string): unknown => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as unknown;
};

const decodeBase64UrlBytes = (value: string): Buffer => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(padded, "base64");
};

const normalizeSha256Fingerprint = (value: string): string | null => {
  const normalized = value.trim().toLowerCase().replace(/^sha256:/, "").replace(/:/g, "");

  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
};

const certificateSha256Fingerprint = (certificate: X509Certificate): string =>
  createHash("sha256").update(certificate.raw).digest("hex");

const isCertificateDateValid = (certificate: X509Certificate, now: Date): boolean => {
  const validFrom = new Date(certificate.validFrom);
  const validTo = new Date(certificate.validTo);

  return Number.isFinite(validFrom.getTime()) && Number.isFinite(validTo.getTime()) && now >= validFrom && now <= validTo;
};

const decodeX5cCertificates = (x5c: readonly string[]): X509Certificate[] | null => {
  try {
    const certificates = x5c.map((entry) => new X509Certificate(Buffer.from(entry, "base64")));

    return certificates.length > 0 ? certificates : null;
  } catch {
    return null;
  }
};

const verifyCertificateChain = (
  certificates: readonly X509Certificate[],
  trustedFingerprints: ReadonlySet<string>,
  now: Date
): boolean => {
  if (certificates.length === 0 || certificates.some((certificate) => !isCertificateDateValid(certificate, now))) {
    return false;
  }

  const trustedRoot = certificates[certificates.length - 1];

  if (!trustedRoot || !trustedFingerprints.has(certificateSha256Fingerprint(trustedRoot))) {
    return false;
  }

  try {
    if (certificates.length === 1) {
      return trustedRoot.verify(trustedRoot.publicKey);
    }

    for (let index = 0; index < certificates.length - 1; index += 1) {
      const certificate = certificates[index];
      const issuer = certificates[index + 1];

      if (!certificate || !issuer || !certificate.verify(issuer.publicKey)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

const readHeaderX5c = (header: Record<string, unknown>): string[] | null => {
  const x5c = Array.isArray(header.x5c) ? header.x5c : null;

  if (!x5c || x5c.length === 0 || x5c.length > 8 || x5c.some((entry) => typeof entry !== "string" || !entry.trim())) {
    return null;
  }

  return x5c.map((entry) => entry.trim());
};

export const createAppStoreNotificationJwsVerifier = ({
  trustedRootCertificateSha256Fingerprints,
  now = () => new Date()
}: AppStoreNotificationJwsVerifierOptions): AppStoreJwsVerifier => {
  const trustedFingerprints = new Set(
    trustedRootCertificateSha256Fingerprints
      .map((fingerprint) => normalizeSha256Fingerprint(fingerprint))
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint))
  );

  return {
    verifyAppStoreJws({ jws }: AppStoreJwsVerificationInput): boolean {
      try {
        const [protectedHeader, payload, signature, ...extraParts] = jws.split(".");

        if (
          trustedFingerprints.size === 0 ||
          extraParts.length > 0 ||
          !protectedHeader ||
          !payload ||
          !signature ||
          !base64UrlSegmentPattern.test(protectedHeader) ||
          !base64UrlSegmentPattern.test(payload) ||
          !base64UrlSegmentPattern.test(signature)
        ) {
          return false;
        }

        const header = decodeBase64UrlJson(protectedHeader);
        const algorithm = isRecord(header) ? normalizeString(header.alg) : null;
        const x5c = isRecord(header) ? readHeaderX5c(header) : null;
        const certificates = x5c ? decodeX5cCertificates(x5c) : null;

        const leafCertificate = certificates?.[0];

        if (
          algorithm !== "ES256" ||
          !certificates ||
          !leafCertificate ||
          !verifyCertificateChain(certificates, trustedFingerprints, now())
        ) {
          return false;
        }

        return verify(
          "sha256",
          Buffer.from(`${protectedHeader}.${payload}`),
          {
            key: leafCertificate.publicKey,
            dsaEncoding: "ieee-p1363"
          },
          decodeBase64UrlBytes(signature)
        );
      } catch {
        return false;
      }
    }
  };
};
