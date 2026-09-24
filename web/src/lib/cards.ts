/** Class names shared by the overview's link cards (headline tiles and the "Explore the data" cards). */

/** The whole card is the link's target, with a hover and focus-visible ring. */
export const LINK_CARD = 'group relative flex flex-col rounded-3xl bg-surface p-5 ring-1 ring-line transition hover:ring-2 hover:ring-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary'
/** The link itself stretches over the card through its ::after pseudo-element. */
export const LINK_STRETCH = 'text-ink no-underline after:absolute after:inset-0 after:rounded-3xl group-hover:text-primary-ink'

/** Pages about a suicide measure show the 988 note themselves (see CrisisNote), so the footer leaves it out there. */
export function showsCrisisNote(pathname: string): boolean {
  return /^\/(?:explore|trends)\/[^/]+\/suicide_/.test(pathname)
}
