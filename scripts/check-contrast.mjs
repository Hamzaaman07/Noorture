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
/*
  Buttons are a soft brand fill with an ink label, not a dark fill with white
  type. A fill light enough to stay in the palette cannot hold white text, and
  a fill dark enough to hold it stops looking like the palette — so the label
  went dark instead. The trade is that the fill is then too close to the page
  to define the control's edge, which the border covers.
*/
const AQUA_TINT = '#D9F2F2'; // --noor-aqua 30% over white, as the button mixes it
const ON_FILL = [
  ['primary btn label', T['noor-ink'], T['noor-rose'], 4.5],
  ['secondary btn label', T['noor-ink'], AQUA_TINT, 4.5],
  ['primary btn edge', T['noor-rose-deep'], T['noor-bg'], 3],
  ['secondary btn edge', T['noor-aqua-deep'], T['noor-bg'], 3],
  ['skip link', '#FFFFFF', T['noor-ink'], 4.5],
];
for (const [use, fg, bg, min] of ON_FILL) {
  row(use, fg, bg, ratio(lumOf(fg), lumOf(bg)), min);
}

/* ---------- pass 2: live, against the real ambience ---------- */

console.log('\nPass 2 — every text element against the ambience actually behind it\n');

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

/*
  Pass 2, measured per element.

  The first version of this took the darkest pixel anywhere on the page and
  checked every token against it. That is conservative to the point of being
  wrong: it failed `aqua-ink` because of a dark patch in the hero, on a page
  where no aqua-ink text is anywhere near it — and it would have forced the
  ambience back down for a collision that does not exist.

  So now each text element is measured against the darkest ambience pixel that
  actually sits behind IT. That is the number a reader experiences, and it lets
  the hero be as bold as it likes in the large empty area around a wordmark
  while still catching real collisions under body copy.
*/
const SAMPLES = [
  ['/', 1280, 900],
  ['/', 390, 844],
  ['/circles/', 1280, 900],
  ['/consultations/', 1280, 900],
  ['/circles/womens-noorture-spring-2026/', 390, 844],
];

const TEXT_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, a, button, label, dt, dd, figcaption, blockquote, span';

let worst = null;
let measured = 0;

for (const [path, width, height] of SAMPLES) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.goto(PREVIEW + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });

  // Walk the page a screen at a time: the ambience is fixed, so what sits
  // behind a paragraph changes as it scrolls through the viewport.
  const screens = await page.evaluate(
    () => Math.ceil(document.body.scrollHeight / window.innerHeight),
  );

  for (let screen = 0; screen < Math.min(screens, 6); screen++) {
    await page.evaluate((i) => window.scrollTo(0, i * window.innerHeight), screen);
    await page.waitForTimeout(450);

    // Text elements in view, with their own colour and box.
    const items = await page.evaluate((sel) => {
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        // Only elements that render their own text, not wrappers.
        const own = [...el.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim(),
        );
        if (!own) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
        // Decorative by declaration — a separator glyph is not text a reader
        // has to make out, and WCAG treats it as incidental.
        if (el.closest('[aria-hidden="true"]')) continue;
        // If the element sits on an opaque background of its own — a filled
        // badge, a card, a button — then the ambience is not its backdrop and
        // measuring against it is meaningless. Those pairs are pass 1's job.
        let node = el;
        let opaque = false;
        while (node && node !== document.documentElement) {
          const bg = getComputedStyle(node).backgroundColor;
          const bm = bg.match(/rgba?\(([^)]+)\)/);
          if (bm) {
            const parts = bm[1].split(',').map((v) => parseFloat(v));
            const alpha = parts.length > 3 ? parts[3] : 1;
            if (alpha >= 0.95) { opaque = true; break; }
          }
          node = node.parentElement;
        }
        if (opaque) continue;
        const m = cs.color.match(/rgba?\(([^)]+)\)/);
        if (!m) continue;
        const [r0, g0, b0, a0 = '1'] = m[1].split(',').map((v) => parseFloat(v));
        if (a0 < 0.9) continue;
        out.push({
          color: [r0, g0, b0],
          label: (el.textContent || '').trim().slice(0, 34),
          x: Math.max(0, Math.floor(r.left)),
          y: Math.max(0, Math.floor(r.top)),
          w: Math.ceil(Math.min(r.width, window.innerWidth - r.left)),
          h: Math.ceil(Math.min(r.height, window.innerHeight - r.top)),
        });
      }
      return out;
    }, TEXT_SELECTOR);

    if (items.length === 0) continue;

    // Hide the content: what is left is the backdrop each element sits on.
    await page.addStyleTag({
      content: 'header,main,footer{visibility:hidden!important}',
    });
    const shot = await page.screenshot();
    await page.evaluate(() => {
      const tags = document.querySelectorAll('style');
      tags[tags.length - 1]?.remove();
    });

    const { data, info } = await sharp(shot)
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (const item of items) {
      let darkest = 2;
      let px = null;
      for (let y = item.y; y < Math.min(item.y + item.h, info.height); y += 2) {
        for (let x = item.x; x < Math.min(item.x + item.w, info.width); x += 2) {
          const i = (y * info.width + x) * info.channels;
          const l = lum(data[i], data[i + 1], data[i + 2]);
          if (l < darkest) {
            darkest = l;
            px = [data[i], data[i + 1], data[i + 2]];
          }
        }
      }
      if (!px) continue;
      measured++;
      const fg = lum(...item.color);
      const r = ratio(fg, darkest);
      if (!worst || r < worst.ratio) {
        worst = {
          ratio: r,
          label: item.label,
          page: `${path} @ ${width}px`,
          fg: item.color.map(Math.round),
          bg: px,
        };
      }
      if (r < 4.5) {
        failures++;
        console.log(
          '  ' +
            'FAIL'.padEnd(6) +
            `"${item.label}"`.padEnd(38) +
            `rgb(${item.color.map(Math.round).join(',')}) on rgb(${px.join(',')})  ` +
            r.toFixed(2) +
            `   ${path} @${width}px`,
        );
      }
    }
  }
  await ctx.close();
}
await browser.close();
stopPreview();

console.log(
  `  ${measured} text elements measured against the ambience actually behind them.`,
);
if (worst) {
  console.log(
    `  tightest: "${worst.label}" at ${worst.ratio.toFixed(2)}  ` +
      `(rgb(${worst.fg.join(',')}) on rgb(${worst.bg.join(',')}), ${worst.page})`,
  );
}

console.log(
  failures === 0
    ? '\nAll pairs meet WCAG 2.1 AA at the final values.\n'
    : `\n${failures} failing pair(s). Darken the token, or lighten the ambience.\n`,
);
process.exit(failures ? 1 : 0);
