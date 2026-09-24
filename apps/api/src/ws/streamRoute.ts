/**
 * @atlas
 * @kind service
 * @partOf primitive:websockets
 * @uses none
 */
import { type RegisteredStream, streamDefinitionFor } from '@template/db/streams';
import { type OperationRoute, resolveOperationRoute } from '#/ws/operationRoute';

export type StreamRoute = { definition: RegisteredStream; route: OperationRoute };

export const resolveStreamRoute = async (stream: string): Promise<StreamRoute | null> => {
  const route = await resolveOperationRoute(stream);
  const definition = route ? streamDefinitionFor(route.operationId) : null;
  if (!route || !definition || route.method !== 'GET') return null;
  return { definition, route };
};
