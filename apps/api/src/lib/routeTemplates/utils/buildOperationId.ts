import { camelCase, upperFirst } from 'lodash';
import pluralize from 'pluralize';

type BuildOperationIdArgs = {
  action: string;
  model: string;
  submodel?: string;
  many?: boolean;
  admin?: boolean;
};

const pascalCase = (str: string) => upperFirst(camelCase(str));

/**
 * Builds operationId to match controller naming pattern exactly.
 * Pattern: {admin?}{model}{Action}{Many?}{Submodel}
 *
 * Rules:
 * - many: true with submodel → plural submodel (meReadManyOrganizations)
 * - many: false with submodel → singular submodel (organizationCreateToken)
 * - many: true without submodel → no submodel (cronJobReadMany)
 *
 * Examples:
 *   - meReadManyOrganizations (many + submodel)
 *   - organizationCreateToken (singular submodel)
 *   - adminCronJobReadMany (no submodel)
 */
export const buildOperationId = ({
  action,
  model,
  submodel,
  many = false,
  admin = false,
}: BuildOperationIdArgs): string => {
  const parts: string[] = [];

  // Start with admin prefix (lowercase) or model (camelCase)
  if (admin) {
    parts.push('admin');
    parts.push(pascalCase(model));
  } else {
    parts.push(camelCase(model));
  }

  // Add action (PascalCase)
  parts.push(pascalCase(action));

  // Add Many if applicable
  if (many) parts.push('Many');

  // Add submodel (PascalCase, pluralized if many: true)
  if (submodel) {
    parts.push(pascalCase(many ? pluralize(submodel) : submodel));
  }

  return parts.join('');
};
