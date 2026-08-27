/**
 * Single source of truth for anything that points off-site or gets repeated
 * across pages. Everything marked TODO is unresolved in the build spec (§9)
 * or simply not supplied yet — fix it here once and every page follows.
 */

export const SITE = {
  name: 'Noorture',
  domain: 'noorture.com',
  tagline: 'Islamic-rooted support for the early years of parenting.',
  description:
    'Consultations, private classes, and support circles from a pediatric nurse practitioner and lactation consultant. Islamic-rooted support for the early years of parenting.',
} as const;

export const CTA = {
  /** The persistent CTA. Spec §3 — wording is fixed, do not paraphrase. */
  primaryLabel: 'Book a free 15-minute call',
  primaryHref: '/consultations#book',
  secondaryLabel: 'Explore the Circles',
  secondaryHref: '/circles',
} as const;

export const NAV = [
  { label: 'Consultations', href: '/consultations' },
  { label: 'Private Class', href: '/private-class' },
  { label: 'Circles', href: '/circles' },
  { label: 'About', href: '/about' },
  { label: 'Reviews', href: '/reviews' },
] as const;

export const SOCIAL = {
  instagram: 'https://www.instagram.com/noorturellc/',
  // TODO(client): supply the LinkedIn profile URL. Placeholder points at search.
  linkedin: 'https://www.linkedin.com/search/results/all/?keywords=Hoda%20Shawky',
  // TODO(client): §9.3 — this is a personal Gmail, not a Noorture-domain address.
  email: 'hoda@noorture.com',
} as const;

/**
 * Podia stays the backend for Circles: checkout, community, course content,
 * member accounts, past-cohort archives. Nothing moves off it (spec §1).
 * TODO(client): confirm the final Podia host before launch (spec §5.4 moves
 * Podia to a subdomain while the apex serves this site).
 */
export const PODIA = {
  root: 'https://www.noorture.com',
  memberLogin: 'https://www.noorture.com/login',
} as const;

/**
 * Every price on the site comes from here — spec §2, which is final. Nothing
 * renders a price literal inline, so there is one place to check that the site
 * matches the price list, and one place to change it.
 */
export const PRICING = {
  consultIntro: { label: 'Free', amount: 0, minutes: 15 },
  consultInitial: { label: '$250', amount: 250, minutes: 90 },
  consultFollowUp: { label: '$195', amount: 195, minutes: 60 },
  privateClass: { label: '$195', amount: 195, suffix: 'per family' },
  circle: {
    label: '$150',
    amount: 150,
    weeks: 12,
    instalments: { count: 3, label: '$50', amount: 50 },
  },
} as const;

/**
 * Private Class topics. §9.5 — the list is incomplete and the client supplies
 * the rest; §4.3 — the topic list is the sales pitch, so a visitor should be
 * able to find her exact question in it. Adding one is adding a line here.
 */
export const CLASS_TOPICS = [
  {
    title: 'Birth',
    blurb:
      'What to expect, how to prepare, and how to meet it with steadiness rather than fear.',
  },
  {
    title: 'Breastfeeding',
    blurb:
      'Latch, supply, positioning, and what to do when feeding is not going the way you were told it would.',
  },
  {
    title: 'Bonding with your baby',
    blurb:
      'Building attachment in the earliest weeks, and what it looks like when it is still finding its footing.',
  },
] as const;

/**
 * Form handling — see the note in BookingBlock.astro.
 *
 * Stage 3 wires the handler and the destination inbox (spec §5.3). Until an
 * endpoint is set here, every form on the site renders normally but explains
 * on submit that it is not yet connected, and offers email as the route in the
 * meantime. Setting `endpoint` is the whole switch-on.
 */
export const FORMS = {
  endpoint: null as string | null,
} as const;

export const CREDENTIALS = [
  '20 years',
  'Pediatric Nurse Practitioner',
  'IBCLC Lactation Consultant',
  'UCLA MSN',
] as const;
