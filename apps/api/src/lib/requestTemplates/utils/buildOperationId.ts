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

export const buildOperationId = ({
  action,
  model,
  submodel,
  many = false,
  admin = false,
}: BuildOperationIdArgs): string => {
  const parts: string[] = [];

  if (admin) parts.push('Admin');
  parts.push(pascalCase(pluralize(model)));
  if (submodel) parts.push(pascalCase(many ? pluralize(submodel) : submodel));
  parts.push(pascalCase(action));
  if (many) parts.push('Many');

  return parts.join('');
};
