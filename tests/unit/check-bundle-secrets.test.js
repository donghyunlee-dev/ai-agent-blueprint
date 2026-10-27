import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanBuiltAssets, formatSecretFindings } from '../../scripts/check-bundle-secrets.mjs';

test('bundle secret scan reports configured secret names and asset paths without values', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blueprint-bundle-secrets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distDirectory = join(root, 'dist');
  await mkdir(join(distDirectory, 'assets'), { recursive: true });
  await writeFile(join(distDirectory, 'assets', 'app.js'), 'const value = "synthetic-openai-secret-sentinel";');
  await writeFile(join(distDirectory, 'index.html'), '<main>safe</main>');

  const findings = await scanBuiltAssets({
    distDirectory,
    env: { OPENAI_API_KEY: 'synthetic-openai-secret-sentinel' },
  });

  assert.deepEqual(findings, [{ name: 'OPENAI_API_KEY', path: 'assets/app.js' }]);
  const report = formatSecretFindings(findings);
  assert.match(report, /OPENAI_API_KEY.*assets\/app\.js/);
  assert.doesNotMatch(report, /synthetic-openai-secret-sentinel/);
  assert.doesNotMatch(JSON.stringify(findings), /synthetic-openai-secret-sentinel/);
});

test('bundle secret scan checks each configured server secret', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blueprint-bundle-secret-types-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distDirectory = join(root, 'dist');
  await mkdir(distDirectory);
  await writeFile(join(distDirectory, 'app.js'), 'openai-value google-value session-value');

  const findings = await scanBuiltAssets({
    distDirectory,
    env: { OPENAI_API_KEY: 'openai-value', GOOGLE_CLIENT_SECRET: 'google-value', APP_SESSION_SECRET: 'session-value' },
  });

  assert.deepEqual(findings.map(({ name }) => name), ['OPENAI_API_KEY', 'GOOGLE_CLIENT_SECRET', 'APP_SESSION_SECRET']);
  assert.doesNotMatch(JSON.stringify(findings), /openai-value|google-value|session-value/);
});

test('bundle secret scan rejects a missing dist directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blueprint-bundle-secrets-missing-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await assert.rejects(
    scanBuiltAssets({ distDirectory: join(root, 'dist'), env: {} }),
    (error) => error.code === 'DIST_DIRECTORY_NOT_FOUND',
  );
});

test('bundle secret scan ignores unconfigured values and succeeds when no configured secrets are present', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'blueprint-bundle-secrets-safe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const distDirectory = join(root, 'dist');
  await mkdir(distDirectory);
  await writeFile(join(distDirectory, 'app.js'), 'const placeholder = "your-server-side-openai-api-key";');

  assert.deepEqual(await scanBuiltAssets({
    distDirectory,
    env: { OPENAI_API_KEY: '', GOOGLE_CLIENT_SECRET: undefined, APP_SESSION_SECRET: '' },
  }), []);
});
