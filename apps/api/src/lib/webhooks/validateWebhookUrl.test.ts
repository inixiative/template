import { describe, expect, it } from 'bun:test';
import { isPrivateAddress, resolveWebhookUrlBlockReason, validateWebhookUrl } from '#/lib/webhooks/validateWebhookUrl';

describe('validateWebhookUrl', () => {
  describe('enforced', () => {
    const enforce = { enforce: true };

    it('allows public https URLs', () => {
      expect(validateWebhookUrl('https://example.com/hooks', enforce)).toBeNull();
      expect(validateWebhookUrl('https://hooks.example.com:8443/path?x=1', enforce)).toBeNull();
    });

    it('rejects malformed URLs', () => {
      expect(validateWebhookUrl('not a url', enforce)).toBe('must be a valid URL');
    });

    it('rejects non-http(s) schemes', () => {
      expect(validateWebhookUrl('ftp://example.com', enforce)).toBe('must use http or https');
      expect(validateWebhookUrl('file:///etc/passwd', enforce)).toBe('must use http or https');
    });

    it('rejects plain http', () => {
      expect(validateWebhookUrl('http://example.com/hooks', enforce)).toBe('must use https');
    });

    it('rejects localhost hostnames', () => {
      expect(validateWebhookUrl('https://localhost/hooks', enforce)).toContain('private or internal');
      expect(validateWebhookUrl('https://api.localhost/hooks', enforce)).toContain('private or internal');
    });

    it('rejects private literal addresses', () => {
      for (const host of [
        '127.0.0.1',
        '10.1.2.3',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254',
        '100.64.0.1',
        '0.0.0.0',
        '[::1]',
        '[fd00::1]',
        '[fe80::1]',
        '[::ffff:10.0.0.1]',
      ]) {
        expect(validateWebhookUrl(`https://${host}/hooks`, enforce)).toContain('private or internal');
      }
    });

    it('allows public literal addresses', () => {
      expect(validateWebhookUrl('https://93.184.216.34/hooks', enforce)).toBeNull();
      expect(validateWebhookUrl('https://[2606:2800:220:1::1]/hooks', enforce)).toBeNull();
    });
  });

  describe('not enforced (local/test)', () => {
    const relaxed = { enforce: false };

    it('allows http and private hosts', () => {
      expect(validateWebhookUrl('http://localhost:3000/hooks', relaxed)).toBeNull();
      expect(validateWebhookUrl('http://10.0.0.1/hooks', relaxed)).toBeNull();
    });

    it('still rejects malformed URLs and non-http schemes', () => {
      expect(validateWebhookUrl('not a url', relaxed)).toBe('must be a valid URL');
      expect(validateWebhookUrl('file:///etc/passwd', relaxed)).toBe('must use http or https');
    });
  });
});

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

describe('isPrivateAddress', () => {
  it('classifies IPv4 ranges', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('203.0.113.10')).toBe(false);
    expect(isPrivateAddress('224.0.0.1')).toBe(true);
    expect(isPrivateAddress('255.255.255.255')).toBe(true);
    expect(isPrivateAddress('198.18.0.1')).toBe(true);
    expect(isPrivateAddress('192.0.0.1')).toBe(true);
  });

  it('classifies IPv6 ranges', () => {
    expect(isPrivateAddress('2606:2800:220:1::1')).toBe(false);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd12:3456::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('ff02::1')).toBe(true);
    expect(isPrivateAddress('::ffff:192.168.0.1')).toBe(true);
  });

  it('returns false for non-IP strings', () => {
    expect(isPrivateAddress('example.com')).toBe(false);
  });
});
