/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
export const isSettingKeyUnderPath = (key: string, path: string): boolean =>
  key === path || key.startsWith(`${path}.`);
