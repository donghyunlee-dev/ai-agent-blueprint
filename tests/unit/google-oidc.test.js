import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from "jose";
import { verifyGoogleIdToken } from "../../api/_lib/google-oidc.js";

const issuer = "https://accounts.google.com";
const audience = "test-client-id";
const nonce = "expected-nonce";

async function createVerifierToken(overrides = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "fixture-key";
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email: "person@example.com", email_verified: true, nonce, ...overrides.claims })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(overrides.issuer || issuer)
    .setAudience(overrides.audience || audience)
    .setSubject("google-subject")
    .setIssuedAt(now)
    .setExpirationTime(overrides.expiration || now + 60)
    .sign(privateKey);
  return { token, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

test("Google ID token verifier accepts valid Google signature and OIDC claims", async () => {
  const { token, jwks } = await createVerifierToken();
  assert.deepEqual(await verifyGoogleIdToken(token, nonce, { jwks, audience }), {
    issuer,
    subject: "google-subject",
    email: "person@example.com",
  });
});

for (const [name, overrides] of [
  ["wrong issuer", { issuer: "https://attacker.example" }],
  ["wrong audience", { audience: "other-client" }],
  ["expired token", { expiration: Math.floor(Date.now() / 1000) - 30 }],
  ["wrong nonce", { claims: { nonce: "different-nonce" } }],
  ["unverified email", { claims: { email_verified: false } }],
]) {
  test(`Google ID token verifier rejects ${name}`, async () => {
    const { token, jwks } = await createVerifierToken(overrides);
    await assert.rejects(verifyGoogleIdToken(token, nonce, { jwks, audience }));
  });
}
