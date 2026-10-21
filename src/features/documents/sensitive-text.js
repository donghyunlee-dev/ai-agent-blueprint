const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/g,
  /((?:["']?\b(?:OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|APP_SESSION_SECRET|[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY))\b["']?)\s*[=:]\s*")[^"\r\n]*(")/gi,
  /((?:["']?\b(?:OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|APP_SESSION_SECRET|[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY))\b["']?)\s*[=:]\s*')[^'\r\n]*(')/gi,
  /((?:["']?\b(?:OPENAI_API_KEY|GOOGLE_CLIENT_SECRET|APP_SESSION_SECRET|[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY))\b["']?)\s*[=:]\s*)[^\s"'`,;]+/gi,
  /(\bBearer\s+)[A-Za-z0-9._~+/-]{12,}={0,2}/gi,
];

export function redactSensitiveText(value) {
  if (typeof value !== 'string') return value;
  let safe = value;
  safe = safe.replace(secretPatterns[0], '[REDACTED]');
  safe = safe.replace(secretPatterns[1], '[REDACTED]');
  safe = safe.replace(secretPatterns[2], '$1[REDACTED]$2');
  safe = safe.replace(secretPatterns[3], '$1[REDACTED]$2');
  safe = safe.replace(secretPatterns[4], '$1[REDACTED]');
  safe = safe.replace(secretPatterns[5], '$1[REDACTED]');
  return safe;
}

export function redactSensitiveValues(value) {
  if (typeof value === 'string') return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, /(?:TOKEN|SECRET|PASSWORD|API_KEY|ACCESS_KEY)/i.test(key) ? '[REDACTED]' : redactSensitiveValues(child)]));
  return value;
}
