/**
 * One card on the landing page: a destination the visitor can open.
 *
 * The landing renders a LIST of these (components/sections/PageCards.astro),
 * so publishing a new section of the site means adding an entry to the array in
 * pages/index.astro — no markup changes, no new layout.
 */
export interface PageCard {
  /** Where the card goes. Use import.meta.env.BASE_URL for in-site links. */
  href: string;
  /** Small label above the title, e.g. "My projects". */
  tag: string;
  title: string;
  description: string;
  /** Label on the card's button. */
  actionText: string;
  /** Theme name — colours the card, its button and its pattern plate. */
  theme?: string;
  /** Daytime artwork (path inside public/, run through utils/asset). */
  imageSrc: string;
  /** Optional night artwork; the stylesheet paints the one that matches. */
  imageSrcNight?: string;
}

/** An outbound credit in the bar under the cards. */
export interface PageCredit {
  href: string;
  text: string;
}
