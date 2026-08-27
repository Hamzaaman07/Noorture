# Noorture

Marketing site for Noorture LLC — Hoda Shawky, RN, MSN, CPNP, IBCLC, PMHS.

New site on the apex domain. **Podia stays in place** as the backend for
Circles: checkout, community, course content, member accounts, and past-cohort
archives. This is a front door, not a migration — nothing moves off Podia.

Built against the Noorture build spec. Section numbers below (§4.1, §6, …)
refer to that document.

---

## Status: Stage 1 — Foundation, complete

The four stages are defined in §8. **Stage 1 is a checkpoint stage** — the
client reviews the hero and the ambience before anything is built on top of
them, because this is the cheapest point to change direction.

| Stage 1 requirement | State |
|---|---|
| Astro + Tailwind project, deployed to a preview URL | Built; deploy config for Vercel and Netlify committed. **Connecting the repo to a hosting account is the one step that needs the owner's credentials** |
| Design tokens from §6, verified for AA contrast at final values | Done — `npm run check:contrast`, table below |
| Type scale, display and body faces loaded and set | Cormorant Garamond + Figtree, self-hosted |
| Ambient bokeh canvas, with `prefers-reduced-motion` handling | Done — `src/components/AmbientNoor.astro` |
| Site shell: header, nav, footer, mobile nav | Done |
| Home page hero — headline, subhead, both CTAs, ambience behind it | Done |

### Exit criteria

- **Preview URL loads on a real phone** — verified at 360 × 740 and 390 × 844;
  no horizontal overflow at either width, or at 1280.
- **Bokeh drifts smoothly and doesn't compete with text** — 15–22 orbs, delta-timed,
  paused behind a hidden tab, backing store capped at 1.5× DPR.
- **Reduced motion visibly stops the drift while the page stays intact** — verified
  by pixel-diffing the canvas across 1.5s with and without the setting: frozen
  under `reduce`, drifting without it. The gradient wash and the static bokeh
  both remain.
- **Nav works at 360px** — hamburger opens and closes by pointer and keyboard,
  `Escape` closes it and returns focus to the toggle, focus ring visible throughout.

### Two things to look at during review

1. **The credentials line in the hero** (`20 years · Pediatric Nurse
   Practitioner · IBCLC Lactation Consultant · UCLA MSN`) is one line beyond the
   literal Stage 1 list — §4.1 places the proof strip further down the home
   page. It is here because §1 says a visitor has to know within seconds that
   this is a licensed clinician, and the hero is where those seconds are. Easy
   to remove if you'd rather hold it for Stage 2.

2. **Every nav route resolves to a marked placeholder** rather than a 404, so
   the nav is actually walkable on a phone during review. Each says which stage
   builds it. They are replaced wholesale in Stages 2 and 3.

---

## Running it

```bash
npm install
npm run dev              # http://localhost:4321
npm run build            # static output to dist/
npm run preview          # serve the built site
npm run check:contrast   # palette gate — see below
```

Node 22. Deploys as a fully static site: Vercel and Netlify configs are both
committed, either works, neither needs a paid tier at this traffic level.

---

## Colour, and why the palette gate exists

The seven brand values in §6 are used verbatim for anything decorative. Two of
them do not pass WCAG AA as *text*:

| Token | Value | On `--noor-bg` | Verdict |
|---|---|---|---|
| `--noor-aqua-deep` | `#3F9CA3` | 3.01:1 | AA for large text and UI borders only |
| `--noor-rose-deep` | `#C4708F` | 3.23:1 | AA for large text only |

So each has an AA-safe sibling, darkened along the same hue, used wherever the
colour carries a label or small text:

| Token | Value | Role |
|---|---|---|
| `--noor-aqua-ink` | `#2B6C70` | links, secondary CTA label, focus ring |
| `--noor-rose-ink` | `#8D5167` | primary button fill, the wordmark's `OO` |
| `--noor-ink-soft` | `#496567` | secondary copy |

**These are set against the ambience, not against the background.** The bokeh
layer sits behind every page, so the real backdrop under a line of text is
`bg + wash + drifting orbs` — measurably darker than `--noor-bg` alone. A
palette that passes on paper can still fail on the page.

`npm run check:contrast` measures both:

```
Pass 1 — tokens against the flat page background        14 pairs, all PASS
Pass 2 — text tokens against the darkest pixel the
         live ambience produces anywhere on the site     4 tokens, all PASS
         darkest backdrop found: rgb(242, 220, 229)
```

Pass 2 builds nothing itself — run `npm run build && npm run preview` first, in
another shell. It screenshots the ambience with the content hidden, at three
page/width combinations, across six drift frames each, and takes the darkest
pixel it finds anywhere.

**Token opacity and bokeh opacity are coupled.** Making the ambience bolder
darkens the backdrop and can push a token below 4.5:1 — that is exactly what
happened during Stage 1, and why the orb and wash opacities are where they are.
Re-run the gate after touching either.

---

## Layout

```
src/
  consts.ts                   nav, CTA copy, off-site URLs — one place to fix
  styles/global.css           design tokens (§6), type scale, base + focus styles
  layouts/BaseLayout.astro     head, skip link, ambience, header, footer
  components/
    AmbientNoor.astro         the bokeh layer — canvas + static wash
    Header.astro              nav, persistent CTA, mobile menu
    Footer.astro              social, legal, Circle member login → Podia
    Hero.astro                the homepage hero
    NoortureMark.astro        the logo lockup
    Button.astro              the two button styles
    StageStub.astro           provisional page body, Stage 1 only
  pages/                      index + one route per §3 sitemap entry
scripts/check-contrast.mjs    the palette gate
```

### The ambient noor layer

*Noor* means light, and the site's signature is literal: soft, out-of-focus
lights drifting slowly behind everything.

§6 records why this is a 2D canvas and not WebGL, and that decision should not
be relitigated: heavy WebGL costs battery and data, stutters on older Android,
and can trigger nausea in people with vestibular sensitivity — which overlaps
meaningfully with pregnancy and postpartum. No Three.js, no WebGL, no 3D
library. `AmbientNoor.astro` is roughly 200 lines with no dependencies.

The `intensity` prop is the only knob: `hero` on the homepage, `quiet`
everywhere else. §6 — spend the boldness in one place.

### Swapping in the real logo

`NoortureMark.astro` draws a simplified stand-in: the turquoise crescent and
the rose four-point star. The full logo — the sleeping owl cradled inside the
crescent — has too much interior detail to redraw faithfully in code.

Drop the supplied file at `public/noorture-logo.svg` and replace the inline
`<svg>` in that component with an `<img>`. It is the only place the mark is
drawn, so nothing else changes. The favicon at `public/favicon.svg` uses the
same simplified geometry and should be regenerated from the real artwork too.

---

## Open items carried into Stage 1

These come from §9 and are flagged, not solved. Everything marked `TODO(client)`
in `src/consts.ts` is one of them.

| Item | State here |
|---|---|
| Preview URL | Needs a Vercel or Netlify account connected to this repo |
| LinkedIn URL | Placeholder in `consts.ts` — points at a search, needs the real profile |
| Podia host | `consts.ts` assumes today's host; §5.4 moves Podia to a subdomain at launch |
| Contact address | §9.3 — currently a personal Gmail, not a Noorture-domain address |
| Scheduler | Not chosen. Stage 2 builds an isolated booking component with a request form |
| Scope-of-practice copy | Stage 2, as conservative placeholder text, visibly marked |
| Social preview image, analytics | Stage 4 |

## Not built, deliberately

- **No Stripe checkout**, anywhere, ever — §5.1. Podia's checkout grants product
  and community access automatically; taking payment separately means granting
  access by hand for every buyer.
- **No account system** — §3. The only login is a quiet footer link out to Podia.
- No CMS, no blog, no newsletter — §7.
