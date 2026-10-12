/**
 * @atlas
 * @kind service
 * @partOf primitive:routeTemplates
 * @uses primitive:shared
 */
import { serializeBracketQuery } from '@template/shared/bracketQuery';

export const apiPath = async (
  operationId: string,
  pathParams?: Record<string, unknown>,
  query?: Record<string, unknown>,
): Promise<string> => {
  const { resolveOperation } = await import('#/lib/openapi/resolveOperation');
  const operation = await resolveOperation(operationId, pathParams);
  if (!operation) throw new Error(`apiPath: cannot resolve "${operationId}"`);
  const search = serializeBracketQuery(query ?? {}).toString();
  return search ? `${operation.path}?${search}` : operation.path;
};
