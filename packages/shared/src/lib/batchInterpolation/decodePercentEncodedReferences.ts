/**
 * @atlas
 * @kind utils
 * @partOf primitive:batch
 * @uses none
 */

const PERCENT_ENCODED_REFERENCE = /%3C%3C(\d+)\.(\d+)\.([a-zA-Z0-9_.]+)%3E%3E/gi;

export const decodePercentEncodedReferences = (path: string): string =>
  path.replace(
    PERCENT_ENCODED_REFERENCE,
    (_match, round: string, request: string, fieldPath: string) =>
      `<<${round}.${request}.${fieldPath}>>`,
  );
