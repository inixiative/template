/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared, primitive:batch
 * @uses none
 */

export const escapeBatchInterpolation = (value: string): string =>
  value.replace(
    /(\\*)(<<|>>)/g,
    (_match, backslashes: string, bracket: string) => `${backslashes}${backslashes}\\${bracket}`,
  );
