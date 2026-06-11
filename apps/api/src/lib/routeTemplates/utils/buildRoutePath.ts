/**
 * @atlas
 * @kind utils
 * @partOf primitive:routeTemplates
 */
import pluralize from 'pluralize';

type BuildRoutePathArgs = {
  submodel?: string;
  action?: string;
  skipId?: boolean;
  many?: boolean;
  operation?: 'create' | 'read' | 'update' | 'delete';
};

export const buildRoutePath = (args: BuildRoutePathArgs): string => {
  const { submodel, action, skipId = false, many = false, operation } = args;

  const parts: string[] = [''];

  // Need :id when: submodel (need parent) OR single-item operation (not create, not many)
  const needsId = !skipId && (submodel || (!many && operation !== 'create'));
  if (needsId) {
    parts.push(':id');
  }

  if (submodel) {
    parts.push(many || operation === 'create' ? pluralize(submodel) : submodel);
  }

  if (action) {
    parts.push(action);
  }

  return parts.join('/') || '/';
};
