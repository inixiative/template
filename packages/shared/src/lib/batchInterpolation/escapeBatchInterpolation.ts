/**
 * @atlas
 * @kind utils
 * @partOf primitive:batch
 * @uses none
 */

export const escapeBatchInterpolation = (value: string): string =>
  value.replace(
    /(\\*)(<<|>>)/g,
    (_match, backslashes: string, bracket: string) => `${backslashes}${backslashes}\\${bracket}`,
  );
