import crypto from 'node:crypto';
import { signSession, buildSessionCookieHeader } from '../_lib/session.js';
import { rejectCrossOriginMutation } from '../_lib/require-session.js';

function finish(res, status) {
  res.statusCode = status;
  res.end();
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const expectedToken = process.env.PREVIEW_E2E_SESSION_TOKEN;
  if (process.env.VERCEL_ENV !== 'preview' || !expectedToken?.trim()) return finish(res, 404);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return finish(res, 405);
  }
  if (rejectCrossOriginMutation(req, res)) return;

  const actualToken = req.headers?.['x-preview-e2e-session-token'];
  if (typeof actualToken !== 'string') return finish(res, 401);
  // Fixed-length digests keep comparison constant-time for all token lengths.
  const actual = crypto.createHash('sha256').update(actualToken).digest();
  const expected = crypto.createHash('sha256').update(expectedToken).digest();
  if (!crypto.timingSafeEqual(actual, expected)) return finish(res, 401);
  if (!process.env.APP_SESSION_SECRET) return finish(res, 503);

  const { value } = signSession({
    issuer: 'https://accounts.google.com',
    subject: 'blueprint-preview-e2e-synthetic',
    email: 'preview-e2e@blueprint.example.test',
  });
  const cookie = buildSessionCookieHeader(value);
  res.setHeader('Set-Cookie', cookie.includes('; Secure') ? cookie : `${cookie}; Secure`);
  return finish(res, 204);
}
