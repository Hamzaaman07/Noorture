#!/usr/bin/env node
/**
 * Deploy preflight for a static Astro site on Cloudflare Pages.
 *
 *   npm run preflight -- [options]
 *
 * Options
 *   --launch          Treat this as the production cutover, not a preview.
 *                     Outstanding placeholders become blockers instead of notes.
 *   --skip-build      Use the existing dist/ rather than rebuilding.
 *   --dist <dir>      Output directory (default: dist)
 *   --only <a,b>      Run only the named gates.
 *
 * Exit code is 0 when every gate passed or skipped, 1 when any gate failed —
 * so it can sit in front of a deploy command with &&.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  buildGate, typesGate, linksGate, contentGate,
  cloudflareGate, placeholderGate, browserGate, runtimeGate,
} from './preflight-gates.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const root = process.cwd();
const dist = resolve(root, value('dist', 'dist'));
const launch = flag('launch');
const only = value('only', null)?.split(',').map((s) => s.trim().toLowerCase());

if (!existsSync(join(root, 'package.json'))) {
  console.error('Run this from the project root (no package.json here).');
  process.exit(1);
}

const GATES = [
  ['build', () => (flag('skip-build')
    ? { name: 'Build', status: 'skip', lines: ['--skip-build; using the existing dist/'] }
    : buildGate(root))],
  ['types', () => typesGate(root)],
  ['links', () => linksGate(root, dist)],
  ['content', () => contentGate(root, dist)],
  ['cloudflare', () => cloudflareGate(root, dist)],
  ['runtime', () => runtimeGate(root, dist)],
  ['contrast', () => browserGate(root, 'Contrast', 'check:contrast')],
  ['placeholders', () => placeholderGate(root, dist, { launch })],
];

const ICON = { pass: '  ok  ', fail: ' FAIL ', warn: ' note ', skip: ' skip ' };

console.log(`\nDeploy preflight — ${launch ? 'LAUNCH (production cutover)' : 'preview deploy'}`);
console.log('='.repeat(64));

const results = [];
for (const [key, fn] of GATES) {
  if (only && !only.includes(key)) continue;
  let result;
  try {
    result = await fn();
  } catch (error) {
    result = { name: key, status: 'fail', lines: [`gate threw: ${error.message}`] };
  }
  results.push(result);
  console.log(`\n[${ICON[result.status]}] ${result.name}`);
  for (const line of result.lines) console.log('        ' + line);
}

const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');

console.log('\n' + '='.repeat(64));
if (failed.length) {
  console.log(`FAILED — ${failed.map((f) => f.name).join(', ')}`);
  console.log('Fix these before deploying.\n');
  process.exit(1);
}
console.log(launch ? 'Ready to point the apex at Cloudflare.' : 'Ready for a preview deploy.');
if (skipped.length) {
  console.log(`Not verified here: ${skipped.map((s) => s.name).join(', ')} — run these somewhere with a browser.`);
}
if (!launch) console.log('Re-run with --launch before the production cutover.');
console.log();
