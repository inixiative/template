/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared, primitive:batch
 * @uses none
 */

const PERCENT_ENCODED_BACKSLASH_LENGTH = '%5C'.length;
const PERCENT_ENCODED_REFERENCE =
  /((?:%5C)*)%3C%3C(\d+)\.(\d+)\.([a-zA-Z0-9_.]+)((?:%5C)*)%3E%3E/gi;

const backslashesFor = (encodedRun: string) =>
  '\\'.repeat(encodedRun.length / PERCENT_ENCODED_BACKSLASH_LENGTH);

export const decodePercentEncodedBatchReferences = (path: string): string =>
  path.replace(
    PERCENT_ENCODED_REFERENCE,
    (
      _match,
      backslashesBeforeOpen: string,
      round: string,
      request: string,
      fieldPath: string,
      backslashesBeforeClose: string,
    ) =>
      `${backslashesFor(backslashesBeforeOpen)}<<${round}.${request}.${fieldPath}${backslashesFor(backslashesBeforeClose)}>>`,
  );
