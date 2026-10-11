/**
 * @atlas
 * @kind validator
 * @partOf primitive:flows
 * @uses none
 */
const APP_ORIGIN = 'https://app.invalid';

export const isAppPath = (value: string): boolean => {
  if (!value.startsWith('/')) return false;
  try {
    const url = new URL(value, APP_ORIGIN);
    return url.origin === APP_ORIGIN && !url.pathname.startsWith('//');
  } catch {
    return false;
  }
};
