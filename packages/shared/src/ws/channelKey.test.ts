import { describe, expect, it } from 'bun:test';
import { channelKey } from '@template/shared/ws';

describe('channelKey', () => {
  it('returns the route identity alone when there is no path scope', () => {
    expect(channelKey({ _id: 'adminBotReadMany' })).toBe('adminBotReadMany');
  });

  it('scopes to path params so detail views route to their resource', () => {
    expect(channelKey({ _id: 'adminBotRead', path: { id: 'b1' } })).toBe('adminBotRead:id:b1');
    expect(channelKey({ _id: 'adminBotRead', path: { id: 'b1' } })).not.toBe(
      channelKey({ _id: 'adminBotRead', path: { id: 'b2' } }),
    );
  });

  it('is order-independent across path keys', () => {
    expect(channelKey({ _id: 'x', path: { spaceId: 's1', id: 'b1' } })).toBe(
      channelKey({ _id: 'x', path: { id: 'b1', spaceId: 's1' } }),
    );
  });

  it('drops query so list variants collapse onto one channel', () => {
    expect(channelKey({ _id: 'adminBotReadMany', query: { page: 1 } } as never)).toBe(
      channelKey({ _id: 'adminBotReadMany', query: { page: 99, status: 'active' } } as never),
    );
  });
});
