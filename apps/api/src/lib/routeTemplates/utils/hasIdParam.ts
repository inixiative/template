/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 * @uses none
 */
export const hasIdParam = (skipId: boolean, submodel: string | undefined, many: boolean): boolean => {
  return !skipId && (!many || !!submodel);
};
