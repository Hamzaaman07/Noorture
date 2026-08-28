/**
 * Client-approved copy, verbatim.
 *
 * §8 Stage 3 exit criterion: "every approved passage matches the source text
 * character-for-character — these are client-approved and must not be
 * paraphrased." So each passage lives here exactly once, pages render from
 * this file rather than restating it, and `npm run preflight` asserts every
 * string below survives into the built HTML.
 *
 * Do not "fix" the punctuation, tighten a sentence, or swap an em dash. If a
 * passage reads oddly, that is a question for the client, not an edit.
 *
 * Passages the spec references but does not contain are NOT here, and are not
 * invented — see MISSING at the bottom.
 */

/** §4.1 — the home page positioning block. */
export const POSITIONING =
  'Noorture provides services, education, and counseling that fuses the evidence-based sciences of maternal and early childhood health and well-being with the richness of our Islamic tradition to help parents not only nurture their children, but to noorture themselves and their little ones starting from the moment they enter into the world.';

/** §4.1 — the line that follows the positioning block. */
export const FOR_WHOM =
  'For anyone caring for a baby or young child — parents and parents-to-be, aunts and uncles, grandparents, teachers, students, and care providers.';

/** §4.7 — opens the reviews page. */
export const REVIEWS_OPENING =
  'Parenthood changed everything, including your relationship with God. For many parents, the overwhelm of busy routines, daily stresses, and the disappointment of unmet expectations can leave them feeling disconnected — from themselves, their children, and even God. It was never meant to be this way. In fact, some of the most profound stories for us to learn from in the Quran come from sacred parent-child relationships. Today our communities are hungry for a sense of connection in their relationships and for a spiritual revival. It begins in the home, with every parent, and with every child. It starts with you taking the first step.';

/** §4.5 — the gift card line. The spec calls it the best copy in the brand. */
export const GIFT_CARD_LINE =
  'May Allah make this a means of replenishing your heart and soul while you give of yourself.';

/**
 * Every approved passage, for the preflight gate to verify against the build.
 */
export const APPROVED_PASSAGES = [
  { name: 'positioning block (§4.1)', page: '/', text: POSITIONING },
  { name: 'who it is for (§4.1)', page: '/', text: FOR_WHOM },
  { name: 'reviews opening (§4.7)', page: '/reviews/', text: REVIEWS_OPENING },
  { name: 'gift card line (§4.5)', page: '/gift/', text: GIFT_CARD_LINE },
] as const;

/**
 * REFERENCED BY THE SPEC BUT NOT SUPPLIED.
 *
 * §4.6 asks for two passages on /about, both client-approved and both to be
 * used verbatim:
 *
 *   1. "What is Noorture" — the full existing passage. The spec quotes only
 *      its opening words, "As much as we want to pour love into our little
 *      ones…"
 *   2. "About Hoda" — the full existing bio, with photo.
 *
 * Neither full text is in the build spec, and §8.5 is explicit that deferred
 * content is built as a marked placeholder rather than invented. Writing a
 * plausible-sounding bio for a licensed clinician would be worse than leaving
 * the gap visible.
 *
 * Paste the real passages into ABOUT_WHAT_IS_NOORTURE and ABOUT_HODA below;
 * /about renders them and drops its placeholder automatically.
 */
export const ABOUT_WHAT_IS_NOORTURE: string | null = null;
export const ABOUT_HODA: string | null = null;
