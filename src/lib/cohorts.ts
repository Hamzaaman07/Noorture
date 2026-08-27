import { getCollection, type CollectionEntry } from 'astro:content';
import { PRICING } from '../consts';

export type Cohort = CollectionEntry<'circles'>;
export type CohortStatus = Cohort['data']['status'];

/**
 * How each of the four states from §4.4 presents itself.
 *
 * Keeping this in one table is what makes the states consistent between the
 * index and the detail page, and what makes "the completed cohort must never
 * look purchasable" a property of the data rather than of each template
 * remembering to check.
 */
export const STATUS_META: Record<
  CohortStatus,
  {
    /** Badge text on the card. */
    label: string;
    /** What the button says. */
    cta: string;
    /** Whether money can change hands. Drives price display everywhere. */
    joinable: boolean;
    /** Completed cohorts are visually recessive (§4.4). */
    muted: boolean;
  }
> = {
  open: {
    label: 'Open — joining now',
    cta: 'Join this Circle',
    joinable: true,
    muted: false,
  },
  'starting-soon': {
    label: 'Starting soon',
    cta: 'Join this Circle',
    joinable: true,
    muted: false,
  },
  waitlist: {
    label: 'Waitlist',
    cta: 'Join the waitlist',
    joinable: false,
    muted: false,
  },
  completed: {
    label: 'Completed',
    // Past members need continued access to their files, which Podia already
    // handles. The old site showed a greyed-out "Sign up now" here, which is
    // the wrong signal in both directions: dead to prospects, and unhelpful to
    // the members who actually need the archive (§4.4).
    cta: 'Members: view your archive',
    joinable: false,
    muted: true,
  },
};

/** Joinable first, completed last. Within a group, soonest start first. */
const RANK: Record<CohortStatus, number> = {
  open: 0,
  'starting-soon': 1,
  waitlist: 2,
  completed: 3,
};

export function sortCohorts(cohorts: Cohort[]): Cohort[] {
  return [...cohorts].sort((a, b) => {
    const byStatus = RANK[a.data.status] - RANK[b.data.status];
    if (byStatus !== 0) return byStatus;
    // Upcoming cohorts read soonest-first; finished ones read newest-first.
    const dir = a.data.status === 'completed' ? -1 : 1;
    return dir * (a.data.startDate.getTime() - b.data.startDate.getTime());
  });
}

/** Every cohort that should be on the site, in display order. */
export async function getCohorts(): Promise<Cohort[]> {
  const all = await getCollection('circles', ({ data }) => !data.draft);
  return sortCohorts(all);
}

/**
 * A cohort's price. Falls back to the standard Circle price from §2, so a new
 * cohort file does not have to restate it — and cannot get it wrong.
 */
export function priceFor(cohort: Cohort) {
  const { instalments, label } = PRICING.circle;
  return (
    cohort.data.price ?? {
      label,
      instalments: `or ${instalments.count} monthly payments of ${instalments.label}`,
    }
  );
}

const DATE = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const DATE_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return DATE.format(date);
}

/** "January 14 – April 1, 2026", collapsing the year when it is shared. */
export function formatRange(start: Date, end?: Date): string {
  if (!end) return DATE.format(start);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${sameYear ? DATE_SHORT.format(start) : DATE.format(start)} – ${DATE.format(end)}`;
}
