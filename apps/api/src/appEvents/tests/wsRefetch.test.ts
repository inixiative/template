import { describe, expect, it } from 'bun:test';
import type { WsRefetchHandler } from '#/appEvents/wsRefetch';
import { planQueryRefetches } from '#/appEvents/wsRefetch';

// Proposed new shape on the handler:
//   ws?: {
//     refetches?: Array<(data: T) => QueryKey | QueryKey[]>;
//     channels?: (data: T) => string[];
//   };
//
// planQueryRefetches is the pure planner that turns that handler + payload
// into a flat list of { channel, queryKey } emissions. The bridge calls
// sendToChannel(channel, { type: 'query.refetch', queryKey }) for each.
// Dedup happens by (channel, JSON.stringify(queryKey)).

type BotPayload = { id: string; status: string };

const buildQueryKey = (operationId: string, opts: { path?: object; query?: object; body?: object } = {}) => [
  operationId,
  { body: opts.body, headers: undefined, path: opts.path, query: opts.query },
];

describe('planQueryRefetches', () => {
  it('emits one refetch per (channel × queryKey) for a single refetch fn', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [(data) => buildQueryKey('adminBotRead', { path: { id: data.id } })],
      channels: () => ['superadmin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toEqual([
      { channel: 'superadmin', queryKey: buildQueryKey('adminBotRead', { path: { id: 'bot-1' } }) },
    ]);
  });

  it('fans across multiple channels for the same queryKey', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [(data) => buildQueryKey('adminBotRead', { path: { id: data.id } })],
      channels: () => ['superadmin', 'org:org-1:admin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toHaveLength(2);
    expect(emissions.map((e) => e.channel).sort()).toEqual(['org:org-1:admin', 'superadmin']);
  });

  it('flattens fns that return arrays of queryKeys', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [
        (data) => [buildQueryKey('adminBotRead', { path: { id: data.id } }), buildQueryKey('adminBotReadMany')],
      ],
      channels: () => ['superadmin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toHaveLength(2);
    expect(emissions.map((e) => e.queryKey[0])).toContain('adminBotRead');
    expect(emissions.map((e) => e.queryKey[0])).toContain('adminBotReadMany');
  });

  it('dedupes identical queryKeys emitted to the same channel from multiple fns', () => {
    const sameKey = (data: BotPayload) => buildQueryKey('adminBotRead', { path: { id: data.id } });
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [sameKey, sameKey],
      channels: () => ['superadmin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toHaveLength(1);
  });

  it('keeps separate emissions for the same queryKey on different channels', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [(data) => buildQueryKey('adminBotRead', { path: { id: data.id } })],
      channels: () => ['superadmin', 'org:org-1:admin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toHaveLength(2);
  });

  it('returns empty when channels function returns empty', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [(data) => buildQueryKey('adminBotRead', { path: { id: data.id } })],
      channels: () => [],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toEqual([]);
  });

  it('returns empty when refetches list is empty', () => {
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [],
      channels: () => ['superadmin'],
    };

    const emissions = planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(emissions).toEqual([]);
  });

  it('passes the event payload to each refetch fn', () => {
    const seen: BotPayload[] = [];
    const handler: WsRefetchHandler<BotPayload> = {
      refetches: [
        (data) => {
          seen.push(data);
          return buildQueryKey('adminBotRead', { path: { id: data.id } });
        },
      ],
      channels: () => ['superadmin'],
    };

    planQueryRefetches(handler, { id: 'bot-1', status: 'connected' });

    expect(seen).toEqual([{ id: 'bot-1', status: 'connected' }]);
  });
});
