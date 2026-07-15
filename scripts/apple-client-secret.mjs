#!/usr/bin/env node
// Generates the Sign in with Apple client secret (ES256 JWT) that Supabase's
// Apple provider expects in its "Secret Key (for OAuth)" field.
//
// Apple caps the secret's lifetime at ~6 months, so this must be re-run and
// the Supabase dashboard value replaced before the printed expiry date.
//
// Usage (run this yourself in a terminal -- the output is a secret):
//   node scripts/apple-client-secret.mjs \
//     --key ~/Downloads/AuthKey_XXXXXXXXXX.p8 \
//     --team-id YOUR_TEAM_ID \
//     --key-id XXXXXXXXXX \
//     --client-id com.defineyou.mongchi.signin
//
// The --client-id must be the SERVICES ID (not the app bundle ID): the secret
// is only used for the web/Android OAuth flow, which runs under the Services
// ID. Native iOS sign-in uses the id_token flow and needs no secret.

import { readFileSync } from "node:fs";
import { createPrivateKey, sign } from "node:crypto";

const SECONDS_PER_DAY = 86400;
const LIFETIME_SECONDS = 180 * SECONDS_PER_DAY; // Apple max is ~182 days; stay under it.

const args = process.argv.slice(2);
const readArg = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
};

const keyPath = readArg("key");
const teamId = readArg("team-id");
const keyId = readArg("key-id");
const clientId = readArg("client-id");

if (!keyPath || !teamId || !keyId || !clientId) {
  console.error("Missing arguments. See the usage comment at the top of this file.");
  process.exit(1);
}

const base64url = (input) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "ES256", kid: keyId };
const payload = {
  iss: teamId,
  iat: now,
  exp: now + LIFETIME_SECONDS,
  aud: "https://appleid.apple.com",
  sub: clientId
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
const privateKey = createPrivateKey(readFileSync(keyPath, "utf8"));
// ieee-p1363 yields the raw r||s signature JOSE/ES256 requires (not ASN.1 DER).
const signature = sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
const jwt = `${signingInput}.${base64url(signature)}`;

console.log("\nApple client secret (paste into Supabase > Auth > Providers > Apple > Secret Key):\n");
console.log(jwt);
console.log(`\nExpires: ${new Date((now + LIFETIME_SECONDS) * 1000).toISOString().slice(0, 10)} -- set a reminder to regenerate before then.\n`);
