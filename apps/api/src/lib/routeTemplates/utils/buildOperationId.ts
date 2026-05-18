import { camelCase, upperFirst } from 'lodash-es';
import pluralize from 'pluralize';

type BuildOperationIdArgs = {
  action: string;
  model: string;
  submodel?: string;
  many?: boolean;
  admin?: boolean;
  internal?: boolean;
};

const pascalCase = (str: string) => upperFirst(camelCase(str));

export const buildOperationId = ({
  action,
  model,
  submodel,
  many = false,
  admin = false,
  internal = false,
}: BuildOperationIdArgs): string => {
  const parts: string[] = [];

  // Start with admin/internal prefix (lowercase) or model (camelCase)
  if (admin) {
    parts.push('admin');
    parts.push(pascalCase(model));
  } else if (internal) {
    parts.push('internal');
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
