import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateGoldenFixture } from '../src/infrastructure/ai/golden-eval.js';

const directory = fileURLToPath(new URL('../tests/eval/golden/', import.meta.url));
const fixtureFiles = (await readdir(directory)).filter((file) => file.endsWith('.fixture.json')).sort();
const failures = [];
let count = 0;

for (const file of fixtureFiles) {
  const parsed = JSON.parse(await readFile(new URL(`../tests/eval/golden/${file}`, import.meta.url), 'utf8'));
  for (const fixture of Array.isArray(parsed) ? parsed : [parsed]) {
    count += 1;
    const result = evaluateGoldenFixture(fixture);
    if (result.pass) console.log(`PASS ${fixture.id}${fixture.expectedPass === false ? ' (expected rejection)' : ''}`);
    else {
      failures.push({ id: fixture.id, errors: result.errors });
      console.error(`FAIL ${fixture.id}: ${result.errors.join('; ')}`);
    }
  }
}

if (!count) {
  console.error('No golden fixtures found.');
  process.exitCode = 1;
} else {
  console.log(`${count - failures.length}/${count} synthetic golden fixtures passed (no provider calls).`);
  if (failures.length) process.exitCode = 1;
}
