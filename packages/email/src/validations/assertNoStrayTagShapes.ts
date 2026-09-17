/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses none
 */
import { ParseBlocksError } from '@template/email/errors/ParseBlocksError';
import { BLOCK_TAG, SLUG_PATTERN } from '@template/email/render/blockTags';

const TAG_SHAPED = /\{\{\s*(#|\/)\s*(component|slot)\s*:[^}]*\}\}/g;

const CLASSIFY_TAG = /^\{\{\s*[#/]\s*(?:component|slot)\s*:\s*([^}:]*?)\s*(?::[^}]*)?\}\}$/;

export const assertNoStrayTagShapes = (input: string): void => {
  const shaped = new Map<number, string>();
  for (const shapedMatch of input.matchAll(TAG_SHAPED)) shaped.set(shapedMatch.index ?? 0, shapedMatch[0]);
  for (const cleanMatch of input.matchAll(BLOCK_TAG)) shaped.delete(cleanMatch.index ?? 0);

  if (shaped.size === 0) return;

  const firstIndex = Math.min(...shaped.keys());
  const offending = shaped.get(firstIndex) ?? input.slice(firstIndex, firstIndex + 40);

  const badName = CLASSIFY_TAG.exec(offending)?.[1];
  if (badName !== undefined && badName !== '' && !SLUG_PATTERN.test(badName)) {
    throw new ParseBlocksError(
      'invalid_slug',
      `Invalid component/slot name "${badName}" — must match ^[a-z0-9-]+$ (tag: ${offending}).`,
    );
  }

  throw new ParseBlocksError(
    'mismatched_close',
    `Malformed component/slot tag near "${input.slice(firstIndex, firstIndex + 40)}" — whitespace-spaced or otherwise non-canonical tags are rejected, not silently treated as text.`,
  );
};
