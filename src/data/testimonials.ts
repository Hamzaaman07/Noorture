/**
 * Approved testimonials.
 *
 * §9.4 — every quote is currently unattributed. `name` and `location` exist so
 * that adding "Amina, Fremont CA" later is a data edit and nothing else; §9
 * notes it roughly doubles credibility for no work beyond getting permission.
 * Even "Circle participant, Spring 2026" would beat nothing.
 *
 * A sixth quote comparing the Circle to a weekly therapy session was
 * DELIBERATELY REMOVED at the client's approval (§4.4). Do not reinstate it:
 * publishing a testimonial that frames a peer support group as therapy creates
 * a scope-of-practice exposure for a licensed NP, and sets the wrong
 * expectation for someone who needs clinical care.
 */
export interface Testimonial {
  quote: string;
  name?: string;
  location?: string;
}

export const CIRCLE_TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'The Quran is supposed to be lived. This is a space like where it is being applied in our lives at home and with our families.',
  },
  {
    quote:
      "Coming to the circle helps bring clarity to the issue I'm having in my life.",
  },
  {
    quote:
      'It feels like a true support group with my sisters because even though we did not know each other from before, the space feels safe enough to open up and share honestly.',
  },
  {
    quote:
      "You're actively engaging with the suras of the Quran to access the meanings by approaching them in this way. It has helped my own Quran journey to find meaning in it. It's not the same as when you are hearing an audio or video recording. It's nicer to be on live all together.",
  },
  {
    quote:
      'The come as you are environment helped people to participate and show up naturally.',
  },
];
