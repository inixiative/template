import { describe, expect, it } from 'bun:test';
import { resolveWebhookUrlBlockReason } from '#/lib/webhooks/validators/resolveWebhookUrlBlockReason';

describe('resolveWebhookUrlBlockReason', () => {
  it('blocks hostnames that resolve to private addresses', async () => {
    const reason = await resolveWebhookUrlBlockReason('https://internal.example.com/hooks', {
      enforce: true,
      lookupFn: async () => [{ address: '10.0.0.5' }],
    });
    expect(reason).toContain('private or internal');
  });

  it('blocks when any resolved address is private', async () => {
    const reason = await resolveWebhookUrlBlockReason('https://rebind.example.com/hooks', {
      enforce: true,
      lookupFn: async () => [{ address: '93.184.216.34' }, { address: '127.0.0.1' }],
    });
    expect(reason).toContain('private or internal');
  });

  it('allows hostnames that resolve publicly', async () => {
    const reason = await resolveWebhookUrlBlockReason('https://hooks.example.com/hooks', {
      enforce: true,
      lookupFn: async () => [{ address: '93.184.216.34' }],
    });
    expect(reason).toBeNull();
  });

  it('passes unresolvable hostnames through (delivery fails as unreachable)', async () => {
    const reason = await resolveWebhookUrlBlockReason('https://nope.example.com/hooks', {
      enforce: true,
      lookupFn: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    expect(reason).toBeNull();
  });

  it('skips DNS entirely when not enforced', async () => {
    let lookups = 0;
    const reason = await resolveWebhookUrlBlockReason('http://test-webhook.local/1', {
      enforce: false,
      lookupFn: async () => {
        lookups++;
        return [{ address: '127.0.0.1' }];
      },
    });
    expect(reason).toBeNull();
    expect(lookups).toBe(0);
  });
});
