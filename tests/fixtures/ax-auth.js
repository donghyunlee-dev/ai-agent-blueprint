// AX Auth /auth/token/verify response fixtures. AX always answers HTTP 200;
// success/failure is decided by the `valid` field, never by HTTP status.

export function validFixture({ email = "user@s-food.com", clientId = "client-1" } = {}) {
  return { valid: true, email, clientId };
}

export function invalidFixture(reason) {
  return { valid: false, reason };
}

export const tokenNotFound = () => invalidFixture("TOKEN_NOT_FOUND");
export const tokenClientMismatch = () => invalidFixture("TOKEN_CLIENT_MISMATCH");
export const tokenExpired = () => invalidFixture("TOKEN_EXPIRED");
export const tokenAlreadyUsed = () => invalidFixture("TOKEN_ALREADY_USED");
export const invalidClient = () => invalidFixture("INVALID_CLIENT");
export const clientDisabled = () => invalidFixture("CLIENT_DISABLED");
export const invalidSecret = () => invalidFixture("INVALID_SECRET");
