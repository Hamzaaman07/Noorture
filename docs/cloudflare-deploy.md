# Deploying to Cloudflare Pages

Everything in the repo is ready. What's left needs the Cloudflare dashboard,
which this session has no credentials for — so §3 below is a prompt to paste
into a browser agent, or to follow yourself.

## 1. What was verified locally

The site was booted under the **real Cloudflare runtime** (`wrangler pages dev`,
which runs workerd — not a generic static server) and asserted against:

- All 12 pages and the 404 served, every asset resolving
- Client-approved copy present in the served HTML, not just in source
- `_headers` applied: hashed assets `immutable`, security headers on every page
- Unknown paths return a real 404 with the custom page
- `_redirects` parsed; control files consumed, not served

Re-run all of it any time with:

```bash
npm run preflight              # before a preview deploy
npm run preflight -- --launch  # before pointing the apex here
```

`--launch` is stricter: it blocks on published provisional copy, forms with no
handler, and an empty redirect map. It currently fails on all three, which is
correct — those are Stage 3 and Stage 4 work.

### One bug this caught

The first `_headers` had `Cache-Control` under `/*`. Cloudflare **appends** the
headers of every matching rule rather than letting a specific rule override a
broad one, so hashed assets came back with:

```
public, max-age=31536000, immutable, public, max-age=0, must-revalidate
```

An ambiguous header that, read the wrong way, revalidates every cached asset on
every request — on the slow connections this audience is actually using. The
build was green throughout; only the real runtime showed it. `/*` now carries
security headers only, and `npm run preflight` asserts a single `Cache-Control`
directive on hashed assets so it cannot come back.

## 2. Settings

| Setting | Value |
|---|---|
| Repo | `Hamzaaman07/Noorture` |
| Project name | `noorture` (matches `name` in `wrangler.toml`) |
| Production branch | **`claude/noorture-phase-1-bypkai`** — see the warning below |
| Framework preset | Astro |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | `22` (also pinned in `.node-version`) |
| Environment variables | none |
| Custom domain | **not yet** — the apex still points at Podia until Stage 4 |

> **The production branch is the thing to get right.** `main` currently contains
> exactly one file — a README. Connecting the repo and accepting the default
> production branch would produce a perfectly green build serving an empty site.
> Either set production to `claude/noorture-phase-1-bypkai`, or merge to `main`
> first and use that.

Deploying by hand instead, from a machine that's logged in:

```bash
npm run preflight && npx wrangler pages deploy dist --project-name noorture
```

## 3. Handoff prompt

Paste everything between the rules into a browser agent, or follow it yourself.

---

I need you to connect a GitHub repo to Cloudflare Pages and get it deploying
automatically. Work through every part and give me the report at the end. If a
step fails, note it and continue rather than stopping.

**Context**

- GitHub repo: `Hamzaaman07/Noorture`
- Intended project name: `noorture` — this must match the `name` field in the
  repo's `wrangler.toml`. Do not let the dashboard silently pick a different
  name; a mismatch creates a second project at a different URL instead of
  updating this one.
- Production branch: `claude/noorture-phase-1-bypkai` — **not `main`**. The
  `main` branch contains only a README; deploying it would build successfully
  and serve an empty site.
- Framework: Astro, **fully static**. There is no server, no SSR, and no API
  routes. The static preset is correct here.

**Part A — Create and connect**

Cloudflare dashboard → Workers & Pages → Create → **Pages** → **Connect to Git**.
Do not use "Direct Upload" — I want automatic deploys on push.

Connect my GitHub account if it isn't already, authorize access to
`Hamzaaman07/Noorture`, and select that repo. If GitHub authorization asks for
something you can't complete, stop and tell me exactly what it's asking for.

**Part B — Build configuration**

Set exactly these and leave every other field at its default:

- Project name: `noorture`
- Production branch: `claude/noorture-phase-1-bypkai`
- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variable: `NODE_VERSION` = `22`

Do not add a custom domain — the live domain still points elsewhere and must not
be touched. Do not add any other environment variables.

**Part C — Deploy and watch**

Trigger the first deployment and watch the build log to completion. If it fails,
copy the **last 30 lines of the log verbatim** — do not summarize.

**Part D — Verify the live site**

Open the live `*.pages.dev` URL and check:

1. Does the homepage show a large serif headline reading "Islamic-rooted support
   for the early years of parenting", with a soft pink-and-turquoise wash behind
   it and a logo of a sleeping owl in a crescent moon at the top left? Screenshot
   the top of the page.
2. Visit each of these and confirm it loads real content, not a 404:
   `/consultations`, `/private-class`, `/circles`,
   `/circles/infant-feeding-spring-2026`, `/circles/womens-noorture-spring-2026`
3. On `/circles`, confirm you see two Circles: "Infant-Feeding Circle" marked
   **Open — joining now**, and "Women's Noorture Circle" under a **Past Circles**
   heading. The past one must show **no price** and its button must read
   "Members: view your archive" — not "Join this Circle".
4. On `/consultations`, confirm the three prices read **Free**, **$250**, **$195**.
5. Open DevTools → Console, reload, and report any red errors verbatim.
6. Open DevTools → Network, reload, and list any request returning 404 or 500.
7. Visit `/definitely-not-a-real-page` and confirm it shows a "We couldn't find
   that page" message and returns status 404 (check the Network tab, not just
   the page).

**Part E — Report**

```
PROJECT NAME:
PRODUCTION BRANCH:
BUILD COMMAND:
OUTPUT DIRECTORY:
NODE VERSION:

DEPLOY RESULT:            [ succeeded | failed ]
BUILD ERROR (verbatim):
LIVE URL:

HOMEPAGE RENDERS AS:      [ real site | starter/scaffold | error | blank ]
ALL 5 ROUTES LOAD:        [ yes | no — which failed ]
PAST CIRCLE CORRECT:      [ yes — no price, archive button | no — describe ]
PRICES CORRECT:           [ Free / $250 / $195 | no — describe ]
404 BEHAVIOUR:            [ custom page + status 404 | describe ]
CONSOLE ERRORS:
FAILED REQUESTS:
```

Plus screenshots.

---

## 4. The launch cutover

`docs/launch.md` is the runbook for pointing the apex here — the URL inventory,
the redirect map, the order the DNS changes have to happen in, and the check
that past members can still reach their archives.

## 5. Not this stage

The apex cutover is Stage 4 and has its own exit criterion: no URL that worked
before launch may break after it. Before that happens, every Podia URL in
circulation — Instagram bio, past emails, gift cards already issued, member
bookmarks — has to be inventoried and given a rule in `public/_redirects`.
Past members reaching their cohort archives is the case that must not break.

`npm run preflight -- --launch` refuses to pass while that file is empty.

One thing worth knowing for that map: Astro emits directory-style pages, so
Cloudflare answers `/circles` with a `308` to `/circles/`. Legacy URLs without a
trailing slash still work; they just take an extra hop.
