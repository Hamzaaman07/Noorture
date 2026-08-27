import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Circle cohorts.
 *
 * §4.4 is explicit that this is the most important maintainability requirement
 * in the whole document: the client updates this site herself several times a
 * year, and adding a cohort must be **one new markdown file and nothing else**.
 *
 * So everything that can carry a sensible default does. In practice a new
 * cohort needs five lines: title, status, startDate, schedule, podiaUrl.
 */
const circles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/circles' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),

      /**
       * Drives everything about how the cohort renders, and its sort position.
       *
       *   open          — joinable now
       *   starting-soon — joinable, start date emphasised
       *   waitlist      — not on sale; email capture instead of a price
       *   completed     — archive link only, never presented as purchasable
       */
      status: z.enum(['open', 'starting-soon', 'waitlist', 'completed']),

      /** Sorts within a status group, and shown on the card. */
      startDate: z.coerce.date(),
      endDate: z.coerce.date().optional(),

      /** Human-readable, e.g. "First four Saturdays of each month, 9am PT". */
      schedule: z.string(),

      /**
       * Podia does checkout, access, community and the archive (§5.1). Every
       * CTA on a cohort points here — there is no checkout on this site.
       * Optional only for a waitlist cohort, which has nothing to link to yet.
       */
      podiaUrl: z.string().url().optional(),

      /** One or two sentences. Shown on the index card and the detail page. */
      description: z.string(),

      /** Optional — the index falls back to a tinted mark when absent. */
      image: image().optional(),
      imageAlt: z.string().optional(),

      /**
       * Overrides only if this cohort is priced differently from the standard
       * Circle. Left unset, it inherits PRICING.circle from consts.ts, so the
       * usual case is not to think about it.
       */
      price: z
        .object({
          label: z.string(),
          instalments: z.string().optional(),
        })
        .optional(),

      /** What the cohort covers. Optional; rendered as a list when present. */
      highlights: z.array(z.string()).default([]),

      /** Hides a cohort without deleting the file. */
      draft: z.boolean().default(false),
    }),
});

export const collections = { circles };
