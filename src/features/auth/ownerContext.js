const CANONICAL_GOOGLE_ISSUER = "https://accounts.google.com";
const OWNER_KEY_PREFIX = "owner:v1:";

export async function deriveOwnerKey(identity) {
  if (
    !identity ||
    identity.issuer !== CANONICAL_GOOGLE_ISSUER ||
    typeof identity.subject !== "string" ||
    identity.subject.length === 0
  ) {
    throw new Error("INVALID_OWNER_IDENTITY");
  }

  const payload = new TextEncoder().encode(JSON.stringify([identity.issuer, identity.subject]));
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", payload));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `${OWNER_KEY_PREFIX}${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

export function createOwnerContextLifecycle({ deriveKey = deriveOwnerKey } = {}) {
  let generation = 0;
  let ownerKey = null;

  return {
    beginCheck() {
      generation += 1;
      ownerKey = null;
      return generation;
    },
    revoke() {
      generation += 1;
      ownerKey = null;
      return generation;
    },
    isCurrent(candidate) {
      return candidate === generation;
    },
    async activate(candidate, identity) {
      if (candidate !== generation) return false;
      const derivedKey = await deriveKey(identity);
      if (candidate !== generation) return false;
      ownerKey = derivedKey;
      return true;
    },
    snapshot() {
      return { generation, ownerKey };
    },
  };
}
