/**
 * Generates public/_redirects from src/data/redirects.json.
 *
 *   node scripts/build-redirects.mjs
 *
 * The generated file is what Cloudflare reads; the JSON is what a person
 * reads. Keeping the source separate means each rule can carry a note
 * explaining why it exists, which is the thing you actually need eighteen
 * months later when deciding whether a rule is still load-bearing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(
  readFileSync(resolve(root, 'src/data/redirects.json'), 'utf8'),
);

const lines = [
  '# GENERATED — do not edit by hand.',
  '# Source: src/data/redirects.json   Regenerate: node scripts/build-redirects.mjs',
  '#',
  '# Cloudflare Pages redirects. One rule per line: <from> <to> <status>',
  '# Limits: 2,000 static rules, 100 dynamic (splat/placeholder) rules.',
  '',
];

if (src.rules.length === 0) {
  lines.push(
    '# No rules yet. Stage 4 inventories every Podia URL in circulation before',
    '# the apex moves — Instagram bio, past emails, gift cards already issued,',
    '# member bookmarks. Past members reaching their cohort archives is the',
    '# case that must not break. See docs/launch.md.',
    '',
  );
} else {
  let group = null;
  for (const rule of src.rules) {
    if (rule.note && rule.note !== group) {
      group = rule.note;
      lines.push(`# ${rule.note}`);
    }
    lines.push(`${rule.from}  ${rule.to}  ${rule.status ?? 301}`);
  }
  lines.push('');
}

writeFileSync(resolve(root, 'public/_redirects'), lines.join('\n'));
console.log(
  src.rules.length === 0
    ? 'public/_redirects written — no rules yet (blocks --launch, as intended)'
    : `public/_redirects written — ${src.rules.length} rule(s)`,
);
