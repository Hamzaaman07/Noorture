# Launch runbook (Stage 4)

The exit criterion for this stage is one sentence:

> **No URL that worked before launch is broken after it.**

The case that must not break is a past Circle member reaching her archive. She
paid for it, and her bookmark may be the only way back.

This stage touches a live business with paying members, which is why it is
separate from the rest of the build. Work the sections in order.

---

## Where things stand

Done and verified in the repo:

- Social preview card at `public/og.png`, generated from the real brand CSS by
  `npm run build:og` — 1200×630, 55 KB
- Complete Open Graph and Twitter tags on every page, with absolute URLs
- `sitemap-index.xml` and `robots.txt`
- Favicons at 32/180/512 from the real artwork
- Analytics slot, off until a token is set — and the privacy page reads that
  setting, so the policy cannot drift from what the site actually does
- Redirect map infrastructure, with a gate that fails if any rule points at a
  page that does not exist
- Keyboard pass: every tab stop reachable with a visible focus ring, across
  five page types at 360px and 1280px
- Reduced motion: drift frozen, quotes plainly visible, page intact
- Contrast: AA at final values, checked against the live ambience
- 13 pages, no dead links, no overflow at 360px

Still needed, and all of it needs someone with access this session does not
have:

| Item | Who |
|---|---|
| Inventory of Podia URLs in circulation | You / a browser agent — §1 below |
| The redirect map filled in from that inventory | Me, once §1 comes back |
| Podia moved to a subdomain | You, at Podia + the registrar |
| Apex pointed at Cloudflare | You, at the registrar |
| Form handler and destination inbox | You — see §4 |
| Analytics token | You, after the first deploy |

---

## 1. Inventory every Podia URL in circulation

**Do this before anything else.** Everything after it depends on knowing what
currently resolves. Outbound network access is blocked in this session, so I
cannot crawl the live site myself — this is a prompt to paste into a browser
agent, or to work through yourself.

---

I need a complete inventory of every URL on a website that is about to move, so
that nothing breaks for existing customers. Be exhaustive; a missed URL means a
paying member hits a 404.

**The site:** `noorture.com` — currently a Podia site.

**Part A — Crawl what is public**

Start at `https://noorture.com` and visit every page you can reach by following
links. For each one, record the full URL and what it is (a product page, a
policy page, the home page, and so on). Include:

- Every product / Circle page, past cohorts included
- Any page reachable from the footer or from a navigation menu
- The login page and anything under an account or members area
- Any checkout or gift URLs you can reach without paying

Do not stop at the first level — follow links from every page you find.

**Part B — Where links to this site actually live**

Check each of these and list every `noorture.com` URL you find, with where you
found it:

1. The Instagram bio and link-in-bio page for `@noorturellc`, including every
   entry if it is a link list
2. Any link in recent Instagram post captions
3. Search the web for `site:noorture.com` and list what is indexed
4. The LinkedIn profile for Hoda Shawky, if it links to the site

**Part C — Report**

Give me one table, and be complete rather than tidy:

```
URL                                  | WHAT IT IS            | WHERE IT'S LINKED FROM
https://noorture.com/                | home                  | Instagram bio
https://noorture.com/<product-slug>  | Circle — Spring 2026  | nav, Instagram post
...
```

Then answer these separately:

```
TOTAL URLS FOUND:
PAST-COHORT / ARCHIVE URLS (the critical ones):
LOGIN OR MEMBER-AREA URL:
GIFT PURCHASE URL:
ANYTHING THAT 404s ALREADY:
ANYTHING BEHIND A LOGIN YOU COULD NOT SEE:
```

---

Two more sources only Hoda can check, because they are not public:

- **Past emails to members** — any newsletter or cohort email with a link
- **Gift cards already issued** — every one carries a redemption URL

## 2. Fill in the redirect map

Add one entry per URL from the inventory to `src/data/redirects.json`:

```json
{
  "from": "/womens-noorture-circle-spring-2026",
  "to": "https://circles.noorture.com/womens-noorture-circle-spring-2026",
  "status": 301,
  "note": "Past cohort — members bookmark this to reach recordings"
}
```

Then `npm run build:redirects && npm run preflight`. The preflight fails if a
rule points at a page that does not exist, and `--launch` fails while the map
is empty.

Rules of thumb:

- A page that still lives on Podia → redirect to its subdomain URL, `301`
- A page this site now owns → redirect to the new path, `301`
- Anything you are unsure about → `302`, and revisit. A wrong `301` is cached
  by browsers for a long time.

## 3. Move Podia, then point the apex

Order matters. Do it the other way round and there is a window where members
can reach nothing.

1. **Set up the Podia subdomain first** (`circles.noorture.com` or similar) and
   confirm it serves the existing site. Podia's own custom-domain settings
   handle this.
2. **Test a real completed-cohort URL on the subdomain** while the apex is
   still on Podia. Sign in as a member and confirm the recordings open. This is
   the check the whole stage exists for.
3. Only then repoint the apex at Cloudflare Pages, and add the custom domain in
   the Cloudflare dashboard.
4. Re-test the same completed-cohort URL through the apex, so the redirect is
   doing its job.

## 4. Wire the forms

Nothing on the site collects a submission yet. Until `FORMS.endpoint` is set in
`src/consts.ts`, every form validates normally and then says plainly that it is
not connected, offering email instead — so no request is silently lost, but no
request arrives either.

Two ways to close this:

- **A form service** (Formspree, Basin, Web3Forms). Cheapest to set up: create
  an endpoint, paste the URL into `FORMS.endpoint`, done. The forms already
  post standard `multipart/form-data` with named fields.
- **A Cloudflare Pages Function** at `functions/api/contact.ts`, forwarding to
  an email API. Keeps everything on one platform and the data on your account,
  at the cost of an API key to manage.

Either way, waitlist submissions must land somewhere retrievable, not only in
an inbox — §5.3 notes the waitlist is the only audience-building mechanism on
the site. The forms already send `source` and `cohort` fields so waitlist
entries are separable on arrival.

## 5. Final pass

```bash
npm run preflight -- --launch
```

It fails while any of these is true, which is the point:

- provisional copy still published (`/consultations`, `/gift`, `/terms`, `/privacy`)
- forms have no handler
- the redirect map is empty

Then, on the live URL rather than a local build: walk the path from homepage to
Podia checkout on a real phone, on cellular rather than wifi.

## 6. After launch

- Add the Cloudflare Web Analytics token to `ANALYTICS` in `src/consts.ts`.
  The privacy page updates its own wording when you do.
- Re-test one completed-cohort URL a week later, once DNS has fully propagated
  and browser caches have turned over.
