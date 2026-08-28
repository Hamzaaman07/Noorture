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

/** Every passage, for the preflight gate to verify against the build. */
export const APPROVED_PASSAGES: Passage[] = Object.entries(passages)
  .filter(([key]) => !key.startsWith('_'))
  .map(([, value]) => value as Passage);
