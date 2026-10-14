export const AI_CONSENT_VERSION = '2026-10-v1';

export function hasCurrentProjectAiConsent(consent, version = AI_CONSENT_VERSION) {
  return Boolean(consent && consent.consentVersion === version && typeof consent.acceptedAt === 'string' && !Number.isNaN(Date.parse(consent.acceptedAt)));
}

/** The caller's accept callback must durably save consent to the owning project before resolving. */
export async function ensureProjectAiConsent({ consent, version = AI_CONSENT_VERSION, decide, accept, send }) {
  if (typeof send !== 'function') throw new TypeError('AI_SEND_REQUIRED');
  let effectiveConsent = consent;
  if (!hasCurrentProjectAiConsent(effectiveConsent, version)) {
    const accepted = typeof decide === 'function' ? await decide({ version }) : false;
    if (!accepted) return { sent: false, reason: 'declined' };
    if (typeof accept !== 'function') return { sent: false, reason: 'persistence_failed' };
    try {
      effectiveConsent = await accept({ acceptedAt: new Date().toISOString(), consentVersion: version });
    } catch {
      return { sent: false, reason: 'persistence_failed' };
    }
    if (!hasCurrentProjectAiConsent(effectiveConsent, version)) return { sent: false, reason: 'persistence_failed' };
  }
  return { sent: true, consent: effectiveConsent, result: await send() };
}
