import copy from './approved-copy.json';

/**
 * Client-approved copy.
 *
 * The words themselves live in approved-copy.json — deliberately JSON, so
 * `npm run preflight` can parse them exactly rather than regexing TypeScript
 * source and hoping. This file only gives them names and types.
 *
 * §8 Stage 3 exit criterion: "every approved passage matches the source text
 * character-for-character — these are client-approved and must not be
 * paraphrased." The preflight asserts exactly that against the built HTML, so
 * a stray edit fails the gate rather than reaching the page.
 *
 * Do not "fix" the punctuation, tighten a sentence, or swap an em dash. If a
 * passage reads oddly, that is a question for the client, not an edit.
 */
export interface Passage {
  /** Human label, used in preflight output. */
  name: string;
  /** Page the passage must appear on. */
  page: string;
  /** One entry per rendered paragraph. */
  paragraphs: string[];
}

const passages = copy as unknown as Record<string, Passage | string[]>;

const get = (key: string): Passage => passages[key] as Passage;

/** §4.1 — the home page positioning block. */
export const POSITIONING = get('positioning').paragraphs[0];
/** §4.1 — the line that follows the positioning block. */
export const FOR_WHOM = get('forWhom').paragraphs[0];
/** §4.7 — opens the reviews page. */
export const REVIEWS_OPENING = get('reviewsOpening').paragraphs[0];
/** §4.5 — the gift card line. The spec calls it the best copy in the brand. */
export const GIFT_CARD_LINE = get('giftCardLine').paragraphs[0];
/** §4.6 — "What is Noorture", two paragraphs. */
export const ABOUT_WHAT_IS_NOORTURE = get('aboutWhatIsNoorture').paragraphs;
/** §4.6 — Hoda's bio. */
export const ABOUT_HODA = get('aboutHoda').paragraphs;
/** §4.2 — the three consultation tiers, in Hoda's own words. */
export const TIER_INTRO = get('tierIntro').paragraphs[0];
export const TIER_INITIAL = get('tierInitial').paragraphs[0];
export const TIER_FOLLOW_UP = get('tierFollowUp').paragraphs[0];
/**
 * §4.2 — the consultations lede.
 *
 * There was a CONSULT_HEADING here too ("Schedule a Noorture Consultation").
 * The client replaced that headline with the page label, so the passage was
 * removed rather than left registered and unrendered — the gate requires every
 * registered passage to appear on its page, and a passage that exists but is
 * never shown is exactly the kind of quiet drift the registry exists to stop.
 */
export const CONSULT_LEDE = get('consultLede').paragraphs[0];
/** §4.3 — the private class lede, which is now the page's opening line. */
export const PRIVATE_CLASS_LEDE = get('privateClassLede').paragraphs[0];
/**
 * §4.4 — the circles lede.
 *
 * The client's text has a double space between "of" and "Light". It is stored
 * that way because this file records what was approved, not a tidied version
 * of it; HTML collapses the pair to a single space on the page, and the
 * preflight normalises whitespace before comparing, so both stay honest.
 */
export const CIRCLES_LEDE = get('circlesLede').paragraphs[0];

/** Every passage, for the preflight gate to verify against the build. */
export const APPROVED_PASSAGES: Passage[] = Object.entries(passages)
  .filter(([key]) => !key.startsWith('_'))
  .map(([, value]) => value as Passage);
