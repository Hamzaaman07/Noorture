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

export const CREDENTIALS = [
  '20 years',
  'Pediatric Nurse Practitioner',
  'IBCLC Lactation Consultant',
  'UCLA MSN',
] as const;
