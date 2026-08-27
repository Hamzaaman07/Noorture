/**
 * Turns the supplied logo file into the assets the site actually uses.
 *
 *   npm run build:logo
 *
 * The source is a 408x324 CMYK JPEG on a white background — a print asset.
 * Three things have to happen before it can go on a web page:
 *
 *   1. CMYK -> sRGB. Browsers render CMYK JPEGs inconsistently, and the
 *      embedded profile is the only correct way to make the conversion.
 *   2. Knock out the background. The page background is a warm blush
 *      off-white (#FAF6F5), so a white JPEG rectangle shows as a visible box,
 *      especially with the ambience drifting behind it.
 *   3. Split the vertical lockup. The header needs a horizontal arrangement,
 *      which means the mark and the wordmark as separate pieces.
 *   4. Bring the colours back to the brand palette. See the note on
 *      RECOLOUR below — this one is a judgement call, and reversible.
 *
 * On the knockout: a plain white-threshold would punch holes straight through
 * the owl, whose body is near-white. So the background is found by flood fill
 * from the border instead — only white that is connected to the outside is
 * removed, and enclosed white stays. Edge pixels get a soft alpha ramp and
 * their colour un-premultiplied from white, which is what keeps the crescent
 * from picking up a pale halo.
 *
 * Outputs land in src/assets/ so Astro's image pipeline handles sizing and
 * format from there. Re-run this if the client supplies new artwork.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src/assets/source/noorture-logo-vertical.jpg');
const OUT = resolve(root, 'src/assets');
const PUB = resolve(root, 'public');

/** Below this minimum channel value a pixel is definitely artwork. */
const INK = 235;

/**
 * Recolour the artwork to the §6 brand tokens.
 *
 * The supplied file carries a U.S. Web Coated (SWOP) v2 profile — a print
 * CMYK profile with a narrower gamut than the screen. Converted correctly, its
 * turquoise lands on #7AB0C6 and its pink on #DFA4A6: duller and hue-shifted
 * from the palette the spec locks, which is #7FD2D4 and #E9A3C4. Those tokens
 * were clearly sampled from an RGB version of this same logo, and §6 names the
 * logo as the palette source. Left alone, the mark sits in the header in
 * visibly different hues from the site built around it.
 *
 * The remap is safe because the artwork is only two colours over white: every
 * pixel fits a blend of white with one of the two bases to within an error of
 * 2/255 for 94% of pixels and 5/255 for 99.5%. So each pixel is decomposed
 * into (base, blend amount), and re-emitted as the same blend of the target
 * token — which preserves every tint, gradient and antialiased edge, and
 * incidentally cleans up the JPEG's colour noise.
 *
 * Set this to false to ship exactly what was supplied.
 */
const RECOLOUR = true;

/** Measured from the supplied file, after the profile conversion. */
const SOURCE_BASES = { aqua: [0x7a, 0xb0, 0xc6], rose: [0xdf, 0xa4, 0xa6] };
/** Spec §6: --noor-aqua and --noor-rose. */
const BRAND_BASES = { aqua: [0x7f, 0xd2, 0xd4], rose: [0xe9, 0xa3, 0xc4] };

/**
 * Spec §6: --noor-aqua-deep and --noor-rose-deep, used for a second wordmark.
 *
 * The supplied wordmark is light aqua, which is beautiful large and nearly
 * invisible at the ~17px cap height of a site header — it stops reading as the
 * brand name and starts reading as decoration. So the same letterforms are
 * emitted a second time in the deeper pair of brand tokens, which is the
 * ordinary dark-on-light logo variant most brands carry. The artwork is not
 * altered; only which brand token it is tinted with.
 */
const DEEP_BASES = { aqua: [0x3f, 0x9c, 0xa3], rose: [0xc4, 0x70, 0x8f] };

/* ------------------------------------------------------------------ */
/* 1. decode to sRGB                                                    */
/* ------------------------------------------------------------------ */

const { data, info } = await sharp(SRC)
  .toColourspace('srgb')
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const W = info.width;
const H = info.height;
const C = info.channels;
const whiteness = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  whiteness[p] = Math.min(data[i], data[i + 1], data[i + 2]);
}

/* ------------------------------------------------------------------ */
/* 2. flood fill the outside                                            */
/* ------------------------------------------------------------------ */

const outside = new Uint8Array(W * H);
const queue = [];
const push = (x, y) => {
  const p = y * W + x;
  if (outside[p] || whiteness[p] < INK) return;
  outside[p] = 1;
  queue.push(p);
};
for (let x = 0; x < W; x++) {
  push(x, 0);
  push(x, H - 1);
}
for (let y = 0; y < H; y++) {
  push(0, y);
  push(W - 1, y);
}
for (let head = 0; head < queue.length; head++) {
  const p = queue[head];
  const x = p % W;
  const y = (p / W) | 0;
  if (x > 0) push(x - 1, y);
  if (x < W - 1) push(x + 1, y);
  if (y > 0) push(x, y - 1);
  if (y < H - 1) push(x, y + 1);
}

/* ------------------------------------------------------------------ */
/* 3. alpha ramp + un-premultiply from white                            */
/* ------------------------------------------------------------------ */

const rgba = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) {
  const s = p * C;
  const d = p * 4;
  let a = 1;
  if (outside[p]) {
    // Fully white -> 0. Right at the ink threshold -> 1. Between the two is
    // the antialiased rim of the artwork.
    a = (255 - whiteness[p]) / (255 - INK);
    a = Math.max(0, Math.min(1, a));
  }
  if (a < 0.02) {
    rgba[d] = rgba[d + 1] = rgba[d + 2] = rgba[d + 3] = 0;
    continue;
  }
  for (let c = 0; c < 3; c++) {
    // observed = true * a + 255 * (1 - a)  ->  solve for true
    const v = (data[s + c] - 255 * (1 - a)) / a;
    rgba[d + c] = Math.max(0, Math.min(255, Math.round(v)));
  }
  rgba[d + 3] = Math.round(a * 255);
}

/* ------------------------------------------------------------------ */
/* 3b. remap the two base colours onto the brand tokens                 */
/* ------------------------------------------------------------------ */

/**
 * Best fit of an observed colour as `white -> base` at some blend amount,
 * returned with the residual so the caller can pick the better of two bases.
 */
function fitToBase(o, base) {
  let num = 0;
  let den = 0;
  for (let c = 0; c < 3; c++) {
    const d = 255 - base[c];
    num += d * (255 - o[c]);
    den += d * d;
  }
  const t = den ? Math.max(0, Math.min(1.2, num / den)) : 0;
  let err = 0;
  for (let c = 0; c < 3; c++) err += (255 - t * (255 - base[c]) - o[c]) ** 2;
  return { t, err };
}

/** Re-tint every pixel onto the given pair of target bases. */
function recolour(source, targets) {
  const out = Buffer.from(source);
  for (let p = 0; p < W * H; p++) {
    const d = p * 4;
    if (out[d + 3] === 0) continue;
    const o = [out[d], out[d + 1], out[d + 2]];
    const aqua = fitToBase(o, SOURCE_BASES.aqua);
    const rose = fitToBase(o, SOURCE_BASES.rose);
    const [fit, target] =
      aqua.err <= rose.err ? [aqua, targets.aqua] : [rose, targets.rose];
    for (let c = 0; c < 3; c++) {
      const v = 255 - fit.t * (255 - target[c]);
      out[d + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return out;
}

const brand = RECOLOUR ? recolour(rgba, BRAND_BASES) : rgba;
const deep = RECOLOUR ? recolour(rgba, DEEP_BASES) : rgba;
if (RECOLOUR) console.log('recoloured to the brand palette, and to a deep variant\n');

const raw = { width: W, height: H, channels: 4 };
const full = sharp(brand, { raw });
const fullDeep = sharp(deep, { raw });

/* ------------------------------------------------------------------ */
/* 4. crop the pieces                                                   */
/* ------------------------------------------------------------------ */

/** Tight bounding box of everything with meaningful alpha in a row range. */
function bounds(y0, y1) {
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < W; x++) {
      if (brand[(y * W + x) * 4 + 3] < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// The lockup has one clear horizontal gutter between the mark and the
// wordmark; find it rather than hard-coding a row that new artwork would break.
const rowHasInk = [];
for (let y = 0; y < H; y++) {
  let ink = false;
  for (let x = 0; x < W && !ink; x++) ink = brand[(y * W + x) * 4 + 3] > 8;
  rowHasInk.push(ink);
}
const bands = [];
let open = null;
rowHasInk.forEach((ink, y) => {
  if (ink && open === null) open = y;
  if (!ink && open !== null) {
    bands.push([open, y - 1]);
    open = null;
  }
});
if (open !== null) bands.push([open, H - 1]);

if (bands.length !== 2) {
  console.error(
    `Expected two bands (mark above, wordmark below); found ${bands.length}.`,
  );
  console.error('Bands:', JSON.stringify(bands));
  process.exit(1);
}

const markBox = bounds(...bands[0]);
const wordBox = bounds(...bands[1]);
const allBox = bounds(0, H - 1);

await mkdir(OUT, { recursive: true });

const pieces = [
  ['noorture-mark.png', markBox, full],
  ['noorture-wordmark.png', wordBox, full],
  ['noorture-lockup.png', allBox, full],
  // The header and footer use this one — see DEEP_BASES above.
  ['noorture-wordmark-deep.png', wordBox, fullDeep],
];
for (const [name, box, source] of pieces) {
  await source.clone().extract(box).png({ compressionLevel: 9 }).toFile(resolve(OUT, name));
  console.log(`${name.padEnd(28)} ${box.width}x${box.height}`);
}

/* ------------------------------------------------------------------ */
/* 5. favicons — the mark alone, on the page background                 */
/* ------------------------------------------------------------------ */

// Squared with padding so the crescent is not clipped by a circular mask,
// and flattened onto --noor-bg: a transparent favicon disappears against a
// dark browser chrome.
const side = Math.max(markBox.width, markBox.height);
const pad = Math.round(side * 0.1);
const squared = await full
  .clone()
  .extract(markBox)
  .extend({
    top: Math.round((side - markBox.height) / 2) + pad,
    bottom: Math.ceil((side - markBox.height) / 2) + pad,
    left: Math.round((side - markBox.width) / 2) + pad,
    right: Math.ceil((side - markBox.width) / 2) + pad,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

for (const [name, size, flatten] of [
  ['favicon-32.png', 32, true],
  ['favicon-180.png', 180, true],
  ['icon-512.png', 512, true],
]) {
  let pipe = sharp(squared).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (flatten) pipe = pipe.flatten({ background: '#faf6f5' });
  await pipe.png({ compressionLevel: 9 }).toFile(resolve(PUB, name));
  console.log(`${name.padEnd(28)} ${size}x${size}`);
}
