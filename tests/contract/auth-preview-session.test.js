import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/auth/preview-session.js';
import sessionHandler from '../../api/auth/session.js';
import { requireSession } from '../../api/_lib/session.js';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { createMockReq, createMockRes } from '../fixtures/http.js';

const token = 'preview-contract-secret-token';
let previousEnv;
beforeEach(() => {
  previousEnv = { ...process.env };
  process.env.VERCEL_ENV = 'preview';
  process.env.PREVIEW_E2E_SESSION_TOKEN = token;
  process.env.APP_SESSION_SECRET = 'preview-contract-session-secret';
  process.env.NODE_ENV = 'production';
});
afterEach(() => {
  for (const name of ['VERCEL_ENV', 'PREVIEW_E2E_SESSION_TOKEN', 'APP_SESSION_SECRET', 'NODE_ENV']) {
    if (previousEnv[name] === undefined) delete process.env[name];
    else process.env[name] = previousEnv[name];
  }
});

function request({ method = 'POST', headers = {}, body } = {}) {
  return { ...createMockReq({ method, url: '/api/auth/preview-session', headers: {
    host: 'preview.example.test', origin: 'https://preview.example.test',
    'x-forwarded-proto': 'https', 'sec-fetch-site': 'same-origin',
    'x-preview-e2e-session-token': token, ...headers,
  } }), body };
}

async function invoke(req = request()) {
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.ended, true);
  assert.equal(res.headers['Cache-Control'], 'no-store');
  return res;
}

test('bootstrap is hidden outside Preview even with a configured token', async () => {
  for (const environment of ['production', 'development', '', undefined]) {
    if (environment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = environment;
    for (const method of ['POST', 'GET', 'OPTIONS']) {
      const res = await invoke(request({ method }));
      assert.equal(res.statusCode, 404);
      assert.equal(res.headers['Set-Cookie'], undefined);
      assert.equal(res.body, undefined);
    }
  }
});

test('bootstrap is hidden without an explicitly configured nonblank token', async () => {
  for (const value of [undefined, '', '   ']) {
    if (value === undefined) delete process.env.PREVIEW_E2E_SESSION_TOKEN;
    else process.env.PREVIEW_E2E_SESSION_TOKEN = value;
    const res = await invoke();
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers['Set-Cookie'], undefined);
  }
});

test('enabled bootstrap accepts POST only and does not allow CORS preflight', async () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']) {
    const res = await invoke(request({ method }));
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'POST');
    assert.equal(res.headers['Set-Cookie'], undefined);
    assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  }
});

test('bootstrap requires the exact single custom-header token', async () => {
  for (const value of [undefined, '', 'wrong', `${token}x`, token.slice(0, -1), [token], ` ${token}`, `${token},${token}`]) {
    const req = request({ headers: { 'x-preview-e2e-session-token': value }, body: { token } });
    req.url += `?token=${token}`;
    const res = await invoke(req);
    assert.equal(res.statusCode, 401);
    assert.equal(res.headers['Set-Cookie'], undefined);
    assert.equal(String(res.body).includes(token), false);
  }
});

test('bootstrap rejects cross-origin, originless and cross-site requests with a valid token', async () => {
  for (const headers of [
    { origin: 'https://attacker.example.test' },
    { origin: undefined },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
  ]) {
    const res = await invoke(request({ headers }));
    assert.equal(res.statusCode, 403);
    assert.equal(res.headers['Set-Cookie'], undefined);
  }
});

test('bootstrap fails closed when the normal session signing secret is missing', async () => {
  delete process.env.APP_SESSION_SECRET;
  const res = await invoke();
  assert.equal(res.statusCode, 503);
  assert.equal(res.headers['Set-Cookie'], undefined);
  assert.equal(String(res.body).includes(token), false);
});

test('bootstrap issues a normal secure session for only the fixed synthetic owner', async () => {
  const req = request({ body: { issuer: 'https://accounts.google.com', subject: 'attacker', email: 'attacker@example.test' } });
  req.query = { subject: 'attacker' };
  const res = await invoke(req);
  assert.equal(res.statusCode, 204);
  assert.equal(res.body, undefined);
  const cookie = res.headers['Set-Cookie'];
  assert.match(cookie, /^__Host-sfb_session=/);
  for (const attribute of ['Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', 'Max-Age=']) assert.ok(cookie.includes(attribute));
  const authenticatedReq = createMockReq({ cookie: cookie.split(';')[0] });
  const session = requireSession(authenticatedReq);
  assert.equal(session.ok, true);
  assert.deepEqual(session.user, {
    issuer: 'https://accounts.google.com', subject: 'blueprint-preview-e2e-synthetic', email: 'preview-e2e@blueprint.example.test',
  });
  assert.equal(typeof await deriveOwnerKey(session.user), 'string');
  const sessionRes = createMockRes();
  await sessionHandler(authenticatedReq, sessionRes);
  assert.equal(sessionRes.statusCode, 200);
  assert.deepEqual(JSON.parse(sessionRes.body).user, session.user);
});

test('bootstrap always sets Secure even when Preview has a nonproduction Node runtime', async () => {
  process.env.NODE_ENV = 'test';
  const res = await invoke();
  assert.equal(res.statusCode, 204);
  assert.match(res.headers['Set-Cookie'], /; Secure(?:;|$)/);
});
