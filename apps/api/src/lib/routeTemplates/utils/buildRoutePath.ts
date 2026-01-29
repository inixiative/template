import pluralize from 'pluralize';

type BuildRoutePathArgs = {
  submodel?: string;
  action?: string;
  skipId?: boolean;
  many?: boolean;
  operation?: 'create' | 'read' | 'update' | 'delete';
};

/**
 * Builds a route path based on submodel, action, and resource flags.
 * Model paths are singular (match Prisma). Submodel paths are plural for collections.
 *
 * Examples:
 * - buildRoutePath({ operation: 'create' }) → '/'
 * - buildRoutePath({ operation: 'read' }) → '/:id'
 * - buildRoutePath({ many: true }) → '/'
 * - buildRoutePath({ submodel: 'token', operation: 'create' }) → '/:id/tokens'
 * - buildRoutePath({ submodel: 'token', many: true }) → '/:id/tokens'
 * - buildRoutePath({ submodel: 'profile' }) → '/:id/profile' (1-1)
 * - buildRoutePath({ action: 'trigger' }) → '/:id/trigger'
 */
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
