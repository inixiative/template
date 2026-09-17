/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */

/**
 * The reserved `{{system.*}}` token surface — the one list both the resolver and any authoring picker
 * read. Pure data, kept apart from the renderer so a browser bundle can import it without dragging the
 * render path in. A second hand-kept copy drifts silently: an offered token nothing resolves ships as
 * literal `{{…}}` text in a delivered email.
 *
 * `kind` is the type badge a picker shows, in the same vocabulary the lens uses for real columns.
 */
export type SystemToken = {
  name: string;
  kind: string;
};

export const SYSTEM_TOKENS = [
  /** A human-readable date for body copy (not a machine timestamp), in the render's locale. */
  { name: 'now', kind: 'DateTime' },
  /** The current year — a copyright line, mostly. */
  { name: 'year', kind: 'Int' },
] as const satisfies readonly SystemToken[];

/** Literal union of the names, so the resolver map is typed exhaustively over this list: a token added
 * here without a resolver is a type error, not an email that ships `{{system.whatever}}` to a customer. */
export type SystemTokenName = (typeof SYSTEM_TOKENS)[number]['name'];
