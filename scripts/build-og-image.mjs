/**
 * Renders the social preview card to public/og.png.
 *
 *   npm run build:og
 *
 * A link to this site gets pasted into WhatsApp groups, Instagram DMs and
 * texts between friends far more often than it gets found by search — §4.5
 * calls the gift path one of the few genuinely viral mechanics here. So the
 * card is the first impression for most arrivals, and a missing one means a
 * bare grey rectangle at exactly that moment.
 *
 * Rendered in the real browser using the real site CSS, so it cannot drift
 * from the brand: same tokens, same fonts, same bokeh wash. Re-run after any
 * palette or logo change.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEW = process.env.PREVIEW_URL || 'http://localhost:4321';
const OUT = resolve(root, 'public/og.png');

const lockup = readFileSync(resolve(root, 'src/assets/noorture-lockup.png')).toString('base64');

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});

// Load the site first so its self-hosted fonts are in the document's cache.
await page.goto(PREVIEW + '/', { waitUntil: 'networkidle' });
const styles = await page.evaluate(() =>
  [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href),
);

await page.setContent(
  `<!doctype html><html><head>
    ${styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('')}
    <style>
      html, body { margin: 0; padding: 0; }
      .card {
        width: 1200px; height: 630px;
        display: grid; place-items: center; text-align: center;
        padding: 0 96px; box-sizing: border-box;
        background:
          radial-gradient(60% 70% at 82% 8%,
            color-mix(in srgb, var(--color-noor-aqua) 34%, transparent), transparent 66%),
          radial-gradient(58% 66% at 14% 22%,
            color-mix(in srgb, var(--color-noor-rose) 32%, transparent), transparent 66%),
          radial-gradient(80% 60% at 50% 104%,
            color-mix(in srgb, var(--color-noor-aqua) 18%, transparent), transparent 70%),
          var(--color-noor-bg);
      }
      .inner { display: grid; justify-items: center; gap: 28px; }
      img { width: 330px; height: auto; }
      p {
        margin: 0; max-width: 22ch;
        font-family: var(--font-display);
        font-size: 48px; line-height: 1.16; font-weight: 500;
        color: var(--color-noor-ink);
      }
      em { color: var(--color-noor-aqua-ink); }
      .creds {
        /* Must not inherit the 22ch measure from the rule above, or the
           credential line wraps to three lines and falls off the card. */
        max-width: none; white-space: nowrap;
        margin: 0; font-family: var(--font-body);
        font-size: 19px; font-weight: 600; letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--color-noor-ink-soft);
      }
    </style>
  </head><body>
    <div class="card"><div class="inner">
      <img src="data:image/png;base64,${lockup}" alt="">
      <p>Islamic-rooted support for the <em>early years of parenting.</em></p>
      <p class="creds">Pediatric Nurse Practitioner &middot; IBCLC Lactation Consultant</p>
    </div></div>
  </body></html>`,
  { waitUntil: 'networkidle' },
);

await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
const raw = await page.screenshot();
await browser.close();

// Quantise: the card is a soft gradient plus flat brand colours, so a palette
// PNG is visually identical at a fraction of the bytes.
const sharp = (await import('sharp')).default;
await sharp(raw).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(OUT);

const { statSync } = await import('node:fs');
console.log(
  `og.png written — 1200x630, ${(statSync(OUT).size / 1024).toFixed(0)} KB ` +
    `(from ${(raw.length / 1024).toFixed(0)} KB)`,
);
