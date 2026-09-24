import type { StreamDefinition, StreamParams } from '@template/shared/ws';
import { isEqual } from 'lodash-es';
import { app } from '#/app';
import { resolveOperationRoute } from '#/ws/operationRoute';
import type { WSHeaders } from '#/ws/probe';
import { routeAccessOf } from '#/ws/routeAccess';

export type AudienceCaller = { label: string; headers: WSHeaders };

// A 'shared' stream fans its appends out to every holder, so every granted caller must see identical data.
export const expectStreamAudience = async <D extends StreamDefinition>(
  definition: D,
  params: StreamParams<D>,
  callers: AudienceCaller[],
): Promise<void> => {
  const route = await resolveOperationRoute(definition.name(params));
  if (!route) throw new Error(`${definition.family}: no route resolves for ${definition.name(params)}`);
  const reads: Array<{ label: string; payload: unknown }> = [];
  for (const { label, headers } of callers) {
    const res = await app.request(route.path, { headers });
    if (routeAccessOf(res.status) !== 'granted') throw new Error(`${definition.family}: ${label} got ${res.status}`);
    reads.push({ label, payload: await res.json() });
  }
  if (definition.audience === 'perRecipient') return;
  const [first, ...rest] = reads;
  for (const read of rest) {
    if (!first || isEqual(read.payload, first.payload)) continue;
    throw new Error(
      `${definition.family} is declared audience 'shared', but ${read.label} and ${first.label} receive different data. ` +
        `Declare audience 'perRecipient' and target its appends with userIds.`,
    );
  }
};
