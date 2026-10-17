/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses none
 */
export type CurrentLocation = { pathname: string; search: string; hash: string };

export const currentLocation = (): CurrentLocation =>
  typeof window === 'undefined'
    ? { pathname: '', search: '', hash: '' }
    : {
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      };

export const currentPath = (): string => {
  const { pathname, search, hash } = currentLocation();
  return `${pathname}${search}${hash}`;
};
