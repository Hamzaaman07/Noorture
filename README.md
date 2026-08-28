# Noorture

Marketing site for Noorture LLC — Hoda Shawky, RN, MSN, CPNP, IBCLC, PMHS.

New site on the apex domain. **Podia stays in place** as the backend for
Circles: checkout, community, course content, member accounts, and past-cohort
archives. This is a front door, not a migration — nothing moves off Podia.

Built against the Noorture build spec. Section numbers below (§4.1, §6, …)
refer to that document.

---

## Status: Stage 3 — Supporting pages, complete except the form handler

Every page in the §3 sitemap exists for real. `/about` now carries both
client-approved passages and Hoda's portrait. One Stage 3 requirement remains
genuinely blocked — the form handler — and is called out rather than quietly
marked done.

| Stage 3 requirement | State |
|---|---|
| `/about` — both approved passages verbatim, photo, Instagram and LinkedIn | Done. Both passages supplied and rendered verbatim; portrait in place |
| `/reviews` — approved opening, all testimonials, optional name/location | Built. Opening verbatim, five Circle quotes. The three general quotes are not in the spec, so that section stays hidden rather than invented |
| `/gift` — artwork, approved copy, accurate fulfilment description | Built. Approved card line verbatim; artwork is a marked typographic stand-in |
| `/contact` — form | Built, including the Circle waitlist path |
| `/terms`, `/privacy` | Built as accurate drafts describing what the site actually does, flagged for legal review |
| Form handler wired, submissions landing in the inbox | **Blocked** — needs the client's form service and destination inbox |
| Waitlist submissions stored somewhere retrievable | **Blocked** — same handler. The data is carried (`source`, `cohort`) so it is separable on arrival |

### How approved copy is protected

All six approved passages live once, in `src/data/approved-copy.json` — JSON
rather than TypeScript so the preflight parses them exactly instead of regexing
source. Two checks run on every preflight:

1. **The text must still hash to its recorded `sha256`.** This is what makes
   editing approved copy a deliberate, visible act: you have to change the hash
   too, and it shows in the diff. Without it, editing the JSON would change both
   the source and the page together and no comparison could see it.
2. **Every paragraph must appear in the built page, unaltered.** On failure the
   gate prints where the text stopped matching.

Both were verified by deliberately breaking them: straightening one curly quote
in the source trips the hash check; truncating the bio in the template trips the
page check and points at the exact divergence. Recompute hashes *only* when the
client has approved new wording — `node scripts/rehash-approved-copy.mjs`.

**One thing to check with the client:** the bio reads "…at the UMass Chan School
of Medicine Early and the Pritzker Foundation, respectively." The word "Early"
looks misplaced. It is rendered exactly as supplied and has **not** been
corrected — approved copy is the client's to change, not ours.

**No form reaches anybody yet.** There is no endpoint and no destination inbox.
Rather than let a real person's 3am booking request vanish, every form
validates normally and then says plainly that it is not connected, offering
email instead. Setting `FORMS.endpoint` in `src/consts.ts` is the entire
switch-on.

### Stage 3 exit criteria

| Criterion | Result |
|---|---|
| Every approved passage matches character-for-character | **Enforced, not eyeballed** — hash on the source, exact match against the built page. 7 paragraphs across 6 passages |
| Every form submits and arrives | **Cannot pass** — no handler exists. Forms validate, report honestly, and are one constant away from live |
| No dead links | Passes — the links gate walks every internal href and `#anchor` across all 13 pages |

Also swept all 13 pages at 360px and 1280px: no overflow, no JS errors, one
`h1` each, no skipped heading levels, no missing alt, no unnamed link, no
unlabelled form field, no tap target under 24px.

### Three bugs found while building this

**Astro swallows a space before an inline tag.** A line of prose ending in a
word, followed by `<a>` or `<em>` on the next line, renders as "theearly
years". This shipped three times before it became a lint —
`npm run preflight` now scans for the pattern, and caught **eight more**
instances in the Stage 3 pages immediately.

**Flexbox strips whitespace too.** Giving footer links `display: inline-flex`
for a bigger tap target made "Instagram @noorturellc" render glued together —
flex discards the whitespace between an anonymous text run and an element
child. Fixed with `gap`; the source was innocent, so no source lint could have
seen it.

**A sharp instance is single-use.** Reusing one for a second pipeline silently
returns the wrong buffer, which broke the logo's colour classification without
erroring.

**The salawat (ﷺ) rendered as a smudge.** Neither the body nor display face
carries U+FDFA, and the system fallbacks squash the ligature into a single em —
not an acceptable way to set a religious honorific, least of all on the page
where this audience decides whether they are understood here. One glyph of Amiri
is now self-hosted, subsetted from 108 KB to 1.6 KB and confined by
`unicode-range` to that single codepoint, with `size-adjust: 150%` so it sits
at a comparable weight to the Latin around it.

---

## Stage 2 — Conversion path, complete

The site is publishable at this point even with Stage 3 and 4 unbuilt — that is
the ordering §8 intends. Home, both booking pages, the Circles index and the
cohort template are all real; the supporting pages are still stubs.

| Stage 2 requirement | State |
|---|---|
| Home, complete — positioning block, three product cards, proof strip, gift band | Done |
| `/consultations` — full copy, three tiers, provisional scope-of-practice language | Done, marked on the page |
| `/private-class` — full copy, topic list with room for more | Done |
| `/circles` — index with all four cohort states | Done |
| `/circles/[slug]` — cohort template, both cohorts seeded | Done |
| Cohort content collection, with schema | `src/content.config.ts` |
| Booking component, isolated — request form for now | `src/components/BookingBlock.astro` |
| Circle testimonials, scroll-revealed, reduced-motion respected | Done — see the note below |

### Stage 2 exit criteria

| Criterion | Result |
|---|---|
| Adding a cohort takes one markdown file and no other edits | **Verified by doing it** — added a dummy cohort, it appeared on the index in the right sort position with its own page, no source file touched; then deleted |
| Every Circle CTA points at the correct Podia URL | Verified against frontmatter in the built HTML |
| The completed cohort shows an archive link, not a purchase button | Verified — CTA reads "Members: view your archive", zero occurrences of "Join this Circle" or any price on that page, and nothing disabled or greyed |
| No Stripe code anywhere | Verified — the only occurrence of the word is the comment recording why there is none |
| Every price matches §2 exactly | Verified — the only prices in the whole build are $250, $195, $150, $50 and "Free" |
| Swapping the scheduler touches one component and no page templates | Verified — `BookingBlock.astro` is the only file in `src/` containing any form markup; both pages pass props and nothing else |

Also checked across all 13 pages at 360px and 1280px: no horizontal overflow, no
JS errors, exactly one `h1` each, no skipped heading levels, no image without
alt, no link without an accessible name, and no tap target under 24px once
stretched-link and expanded hit areas are accounted for.

### Two things found and fixed while building this

**The scroll reveal had a real bug.** Implemented the obvious way — an
IntersectionObserver, reveal on `isIntersecting` — a quote that is jumped clean
past between two frames is never reported as intersecting and stays at opacity
0 permanently. A hard flick on a phone, an in-page anchor, or a restored scroll
position all do that, and testing reproduced it on both `/` and `/circles`. The
result is a quote the reader can never read, which is worse than no animation.
It is now written as a scroll-position predicate — "reveal anything whose top
has passed the trigger line" — which is true however the page arrived at that
position. The listeners detach once every quote has revealed.

**Scoped styles do not reach a child component's root.** Passing
`class="prose"` into `<Section>` and styling `.prose` from the parent silently
matched nothing, which left the cohort body copy and its headings unstyled.
Fixed by owning the wrapper element; there is now a note in `Section.astro` so
the next person does not spend the same twenty minutes.

---

## Stage 1 — Foundation, complete

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

### The hero

At the client's direction the hero now leads with the logo itself rather than
a text headline. §4.1 had argued the other way — "Noorture" is a coined word,
and the old site spent three paragraphs decoding it before saying what was for
sale — so the tagline sits immediately beneath the mark at a size that cannot
be missed. The brand leads; the sentence that explains it is the very next
thing the eye lands on.

The lockup is capped at 360px wide. The supplied artwork is 392px, and pushed
larger it goes visibly soft on the phones this audience uses. Tracing it to
vector was tried and rejected: the source is a JPEG, so its edges carry
compression ringing, and the traced curves came out wavier than the raster is
soft. A logo that reads as badly drawn is worse than one that reads as slightly
soft. **Vector artwork would remove the cap** — worth asking for.

### Two things to look at during review

1. **The credentials line in the hero** (`20 years · Pediatric Nurse
   Practitioner · IBCLC Lactation Consultant · UCLA MSN`) is one line beyond the
   literal Stage 1 list — §4.1 places the proof strip further down the home
   page. It is here because §1 says a visitor has to know within seconds that
   this is a licensed clinician, and the hero is where those seconds are. Easy
   to remove if you'd rather hold it for Stage 2.

2. **Remaining nav routes resolve to marked placeholders** rather than 404s, so
   the nav is walkable on a phone. Each says which stage builds it. `/about`,
   `/reviews`, `/gift`, `/contact`, `/terms` and `/privacy` are Stage 3.

---

## Running it

```bash
npm install
npm run dev              # http://localhost:4321
npm run build            # static output to dist/
npm run preview          # serve the built site
npm run check:contrast   # palette gate — see below
npm run build:logo       # regenerate logo assets from the supplied artwork
npm run preflight        # full deploy gate — see below
```

### Deploying

Cloudflare Pages, static. `docs/cloudflare-deploy.md` has the exact settings, a
paste-ready handoff prompt for the dashboard, and the launch caveats.

```bash
npm run preflight              # before a preview deploy
npm run preflight -- --launch  # before pointing the apex here
```

The preflight builds, type-checks, walks every internal link and anchor, checks
the prices against `consts.ts` and the cohort states against their frontmatter,
validates the Cloudflare config, runs the contrast gate, and then **boots the
real Cloudflare runtime** (`wrangler pages dev`, i.e. workerd) to assert against
what will actually be served — headers, 404s, trailing slashes, every page.

That last part is the one that pays. `npm run build` proves the bundler was
happy and nothing more. The first `_headers` file put `Cache-Control` under
`/*`; Cloudflare *appends* the headers of every matching rule rather than
letting a specific rule win, so hashed assets came back with
`max-age=31536000, immutable, ..., max-age=0, must-revalidate` — ambiguous, and
read the wrong way it revalidates every cached asset on every request, on
exactly the slow connections this audience has. Every build was green. Only the
runtime showed it.

`--launch` additionally blocks on published provisional copy, forms with no
handler, and an empty redirect map. It fails on all three today, which is
correct — those are Stage 3 and Stage 4.

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

### Adding a Circle cohort

One file in `src/content/circles/`, and nothing else. Five lines are required:

```yaml
---
title: Infant-Feeding Circle
status: open          # open | starting-soon | waitlist | completed
startDate: 2026-03-07
schedule: First four Saturdays of each month, 9am PT
podiaUrl: https://…   # where Join goes. Omit for a waitlist cohort.
description: One or two sentences, shown on the card and the page.
---

Body copy here.
```

Everything else has a default. The price is inherited from §2 unless the cohort
is priced differently, so it cannot drift out of step with the price list.
`status` decides the sort position, the badge, whether a price is shown at all,
and what the button says — a `completed` cohort can never render as
purchasable, because that is a property of the data rather than of each
template remembering to check.

Set `draft: true` to hide one without deleting the file.

### The logo

The client supplied a 408×324 CMYK JPEG on white — a print asset.
`npm run build:logo` prepares it: converts through the embedded SWOP profile,
knocks out the background by flood fill from the border (a plain white
threshold would punch holes through the owl, whose body is near-white), splits
the vertical lockup into mark and wordmark, and writes favicons.

It also re-tints the artwork onto the §6 brand tokens. Converted correctly,
SWOP's narrower gamut puts the turquoise at `#7AB0C6` and the pink at `#DFA4A6`
— duller and hue-shifted from the `#7FD2D4` / `#E9A3C4` the spec locks. Since
§6 names the logo as the palette source, the mark is brought to the palette
rather than the other way round. Set `RECOLOUR = false` in the script to ship
the file exactly as supplied.

A second wordmark is emitted in the deeper brand tokens, and that is the one
the header and footer use: the supplied light aqua is lovely large and nearly
invisible at a header's cap height, where it stops reading as the brand name.

**Worth asking the client for the RGB or vector original** — 408px is thin for
a logo, and it would make the re-tint unnecessary.

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
| Scheduler | Not chosen (§9.6). `BookingBlock.astro` renders a request form and is the only file to change when one is picked |
| Form handler | Not wired (§5.3, Stage 3). Until `FORMS.endpoint` is set in `consts.ts`, forms validate normally and then say plainly that they are not connected yet, offering email instead — rather than swallowing a real person's request |
| Scope-of-practice copy | On `/consultations`, marked on the page as provisional pending the licensing board or an attorney (§9.1) |
| Testimonial attribution | All quotes unattributed (§9.4). `name` and `location` fields exist and are unused |
| Private Class topics | Three known (§9.5). The list is a constant in `consts.ts`; the page has a fourth "Something else" card inviting the question rather than padding the list |
| Insurance / reimbursement | Nothing built (§9.2) |
| Waitlist storage | Stage 3. No cohort currently uses `waitlist` status |
| Social preview image, analytics | Stage 4 |

## Not built, deliberately

- **No Stripe checkout**, anywhere, ever — §5.1. Podia's checkout grants product
  and community access automatically; taking payment separately means granting
  access by hand for every buyer.
- **No account system** — §3. The only login is a quiet footer link out to Podia.
- No CMS, no blog, no newsletter — §7.
