/**
 * Recompute the recorded hashes in src/data/approved-copy.json.
 *
 * Run this ONLY when the client has approved new wording. The hashes exist so
 * that changing approved copy is a deliberate act that shows up in a diff,
 * rather than something that slips through in a tidy-up — so running this to
 * silence a failing preflight defeats the entire point.
 *
 *   node scripts/rehash-approved-copy.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const file = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/approved-copy.json',
);
const copy = JSON.parse(readFileSync(file, 'utf8'));

let changed = 0;
for (const [key, passage] of Object.entries(copy)) {
  if (key.startsWith('_')) continue;
  const hash = createHash('sha256')
    .update(passage.paragraphs.join('\n\n'), 'utf8')
    .digest('hex');
  if (passage.sha256 !== hash) {
    console.log(`${passage.name}\n  was ${passage.sha256 ?? '(none)'}\n  now ${hash}`);
    passage.sha256 = hash;
    changed++;
  }
}

writeFileSync(file, JSON.stringify(copy, null, 2) + '\n');
console.log(changed === 0 ? 'No changes.' : `Updated ${changed} hash(es).`);
