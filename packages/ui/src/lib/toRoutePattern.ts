/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
export const toRoutePattern = (openApiPath: string) =>
  openApiPath.replaceAll(/\{([^}/]+)\}/g, ':$1');
