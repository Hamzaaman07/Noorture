/**
 * Contrast gate for the Noorture palette.
 *
 * Two passes, because one is not enough here:
 *
 *   1. Flat  — every token pair against the page background, the ordinary
 *              WCAG check.
 *   2. Live  — every text token against the darkest pixel the ambient bokeh
 *              layer actually produces. The bokeh sits behind all content, so
 *              the true backdrop under a line of text is bg + wash + orbs,
 *              which is measurably darker than bg alone. Skipping this pass is
 *              how a palette passes on paper and fails on a phone.
 *
 * Pass 2 needs a built site: `npm run build` first. If nothing is answering on
 * the preview URL it starts its own `astro preview` and shuts it down after,
 * so the check is self-contained and safe to run from `npm run preflight`.
 *
 *   npm run check:contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = process.env.PREVIEW_URL || 'http://localhost:4321';

/* ---------- colour maths (sRGB relative luminance, WCAG 2.1) ---------- */

const chan = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const parse = (hex) => hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16));
const lumOf = (hex) => lum(...parse(hex));
const ratio = (a, b) => {
  const [hi, lo] = [a, b].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* ---------- tokens, read from the stylesheet so they cannot drift ---------- */

const css = readFileSync(resolve(root, 'src/styles/global.css'), 'utf8');
const T = Object.fromEntries(
  [...css.matchAll(/--color-(noor-[a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map(
    ([, name, hex]) => [name, hex.toUpperCase()],
  ),
);

const need = (kind) => (kind === 'large' || kind === 'ui' ? 3 : 4.5);
let failures = 0;

const row = (use, fg, bg, r, min) => {
  const ok = r >= min;
  if (!ok) failures++;
  console.log(
    '  ' +
      use.padEnd(24) +
      fg.padEnd(10) +
      bg.padEnd(10) +
      r.toFixed(2).padStart(5) +
      '  need ' +
      min.toFixed(1) +
      '  ' +
      (ok ? 'PASS' : 'FAIL'),
  );
};

/* ---------- pass 1: flat ---------- */

console.log('\nPass 1 — tokens against the flat page background\n');
const FLAT = [
  ['body text', 'noor-ink', 'noor-bg', 'text'],
  ['body text on tint', 'noor-ink', 'noor-bg-alt', 'text'],
  ['secondary copy', 'noor-ink-soft', 'noor-bg', 'text'],
  ['secondary copy on tint', 'noor-ink-soft', 'noor-bg-alt', 'text'],
  ['link / label', 'noor-aqua-ink', 'noor-bg', 'text'],
  ['link on tint', 'noor-aqua-ink', 'noor-bg-alt', 'text'],
  ['link hover', 'noor-aqua-ink-hover', 'noor-bg', 'text'],
  ['rose label', 'noor-rose-ink', 'noor-bg', 'text'],
  ['rose label on tint', 'noor-rose-ink', 'noor-bg-alt', 'text'],
  ['focus ring', 'noor-aqua-ink', 'noor-bg', 'ui'],
  ['secondary btn border', 'noor-aqua-deep', 'noor-bg', 'ui'],
];
for (const [use, fg, bg, kind] of FLAT) {
  row(use, T[fg], T[bg], ratio(lumOf(T[fg]), lumOf(T[bg])), need(kind));
}
const WHITE_ON = [
  ['primary btn label', 'noor-rose-ink'],
  ['primary btn hover', 'noor-rose-ink-hover'],
  ['skip link', 'noor-ink'],
];
for (const [use, fill] of WHITE_ON) {
  row(use, '#FFFFFF', T[fill], ratio(lumOf('#FFFFFF'), lumOf(T[fill])), 4.5);
}

/* ---------- pass 2: live, against the real ambience ---------- */

console.log('\nPass 2 — text tokens against the darkest pixel of the live ambience\n');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.log('  Playwright is not installed — pass 2 skipped.');
  console.log('  Install it (npm i -D playwright) and re-run before shipping a');
  console.log('  palette or bokeh-opacity change.\n');
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('  sharp is not resolvable — pass 2 skipped.\n');
  process.exit(1);
}

// Bring up a preview server unless one is already answering. Assuming an
// external server is running makes this fail for reasons that have nothing to
// do with contrast, which is exactly the kind of noise that gets a check
// ignored.
const reachable = async () => {
  try {
    await fetch(PREVIEW + '/', { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

let previewProc = null;
if (!(await reachable())) {
  const { spawn } = await import('node:child_process');
  const port = new URL(PREVIEW).port || '4321';
  previewProc = spawn('npx', ['astro', 'preview', '--port', port], {
    cwd: root,
    stdio: 'ignore',
    detached: true,
  });
  let up = false;
  for (let i = 0; i < 20 && !up; i++) {
    await new Promise((r) => setTimeout(r, 750));
    up = await reachable();
  }
  if (!up) {
    console.log('  Could not start a preview server — run `npm run build` first.\n');
    try { process.kill(-previewProc.pid, 'SIGKILL'); } catch {}
    process.exit(1);
  }
}

const stopPreview = () => {
  if (previewProc) {
    try { process.kill(-previewProc.pid, 'SIGKILL'); } catch {}
    previewProc = null;
  }
};
process.on('exit', stopPreview);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// Every page carries the ambience, so sample the loud one (home, 'hero')
// and a quiet one, at both a phone and a desktop width.
const SAMPLES = [
  ['/', 1280, 900],
  ['/', 390, 844],
  ['/circles/', 1280, 900],
  ['/consultations/', 1280, 900],
  ['/circles/womens-noorture-spring-2026/', 390, 844],
];

let worst = { l: 2, px: null, where: null };

for (const [path, width, height] of SAMPLES) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(PREVIEW + path, { waitUntil: 'networkidle' });
  // Hide the content: what is left in the shot is the backdrop alone.
  await page.addStyleTag({
    content: 'header,main,footer{visibility:hidden!important}',
  });
  // Let the orbs drift through several arrangements and keep the darkest.
  for (let f = 0; f < 6; f++) {
    await page.waitForTimeout(1100);
    const { data, info } = await sharp(await page.screenshot())
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels * 7) {
      const l = lum(data[i], data[i + 1], data[i + 2]);
      if (l < worst.l) {
        worst = {
          l,
          px: [data[i], data[i + 1], data[i + 2]],
          where: `${path} @ ${width}px`,
        };
      }
    }
  }
  await ctx.close();
}
await browser.close();
stopPreview();

console.log(
  `  darkest backdrop found: rgb(${worst.px.join(', ')})  —  ${worst.where}\n`,
);
for (const name of [
  'noor-ink',
  'noor-ink-soft',
  'noor-aqua-ink',
  'noor-rose-ink',
]) {
  row(name.replace('noor-', ''), T[name], 'ambience', ratio(lumOf(T[name]), worst.l), 4.5);
}

console.log(
  failures === 0
    ? '\nAll pairs meet WCAG 2.1 AA at the final values.\n'
    : `\n${failures} failing pair(s). Darken the token, or lighten the ambience.\n`,
);
process.exit(failures ? 1 : 0);
