import { readdir, readFile } from 'node:fs/promises';
import { basename, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECRET_NAMES = ['OPENAI_API_KEY', 'GOOGLE_CLIENT_SECRET', 'APP_SESSION_SECRET'];

function missingDistError() {
  const error = new Error('Built dist directory is missing or is not a directory.');
  error.code = 'DIST_DIRECTORY_NOT_FOUND';
  return error;
}

export async function scanBuiltAssets({ distDirectory, env = process.env }) {
  const root = resolve(distDirectory);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') throw missingDistError();
    throw error;
  }

  const secrets = SECRET_NAMES
    .map((name) => [name, env[name]])
    .filter(([, value]) => typeof value === 'string' && value.length > 0)
    .map(([name, value]) => ({ name, bytes: Buffer.from(value) }));
  const findings = [];

  async function scanDirectory(directory, children) {
    for (const child of children) {
      const absolutePath = resolve(directory, child.name);
      if (child.isDirectory()) {
        await scanDirectory(absolutePath, await readdir(absolutePath, { withFileTypes: true }));
      } else if (child.isFile()) {
        const contents = await readFile(absolutePath);
        const assetPath = relative(root, absolutePath).split(sep).join('/');
        for (const secret of secrets) {
          if (contents.includes(secret.bytes)) findings.push({ name: secret.name, path: assetPath });
        }
      }
    }
  }

  await scanDirectory(root, entries);
  return findings;
}

export function formatSecretFindings(findings) {
  return findings.map(({ name, path }) => `${name}: dist/${path}`).join('\n');
}

async function main() {
  const distDirectory = fileURLToPath(new URL('../dist', import.meta.url));
  try {
    const findings = await scanBuiltAssets({ distDirectory, env: process.env });
    if (findings.length > 0) {
      process.stderr.write(`Configured secrets found in built assets:\n${formatSecretFindings(findings)}\n`);
      process.exitCode = 1;
    } else {
      process.stdout.write('No configured secrets found in built assets.\n');
    }
  } catch (error) {
    if (error.code === 'DIST_DIRECTORY_NOT_FOUND') {
      process.stderr.write(`${error.code}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`Bundle secret scan failed (${error.code ?? 'UNKNOWN_ERROR'}).\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
