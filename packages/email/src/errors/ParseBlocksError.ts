/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type ParseBlocksErrorReason =
  | 'mismatched_close'
  | 'stray_close'
  | 'unclosed_open'
  | 'invalid_slug'
  | 'invalid_modifier'
  | 'duplicate_slot';

export class ParseBlocksError extends Error {
  constructor(
    readonly reason: ParseBlocksErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'ParseBlocksError';
  }
}
