import { describe, expect, it, mock } from 'bun:test';
import { createHmac } from 'node:crypto';
import { BillingAccountStatus, BillingProvider } from '@template/db/generated/client/enums';
import { createPolarBillingClient } from '#/lib/billing/client/polar';

const signStandardWebhook = (
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): string => {
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8');
  const sig = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return `v1,${sig}`;
};

const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createPolarBillingClient', () => {
  it('ensureCustomer looks up existing customer before creating team customer', async () => {
    const fetchMock = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (init?.method === 'GET' && target.endsWith('/v1/customers/external/ba_1')) {
        return jsonResponse(404, { error: 'NotFound' });
      }
      if (init?.method === 'POST' && target.endsWith('/v1/customers/')) {
        const parsed = JSON.parse(String(init.body));
        expect(parsed.type).toBe('team');
        expect(parsed.external_id).toBe('ba_1');
        expect(parsed.owner.email).toBe('billing@example.com');
        expect(parsed.owner.external_id).toBe('ba_1:owner');
        return jsonResponse(201, { id: 'cus_polar_1' });
      }
      return jsonResponse(500);
    });

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const result = await client.ensureCustomer({
      accountId: 'ba_1',
      billingEmail: 'billing@example.com',
      name: 'Acme Billing',
      kind: 'organization',
    });

    expect(client.provider).toBe(BillingProvider.polar);
    expect(client.capabilities.requiresUniqueEmail).toBe(false);
    expect(result).toEqual({ externalCustomerId: 'cus_polar_1' });
  });

  it('createPortalSession uses external_customer_id and external_member_id', async () => {
    const fetchMock = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      const parsed = JSON.parse(String(init?.body));
      expect(parsed).toEqual({
        external_customer_id: 'ba_2',
        external_member_id: 'ba_2:owner',
        return_url: 'https://app.example.com/billing',
      });
      return jsonResponse(201, { customer_portal_url: 'https://sandbox.polar.sh/portal/session' });
    });

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const portal = await client.createPortalSession({
      accountId: 'ba_2',
      externalCustomerId: 'cus_2',
      returnUrl: 'https://app.example.com/billing',
    });
    expect(portal.url).toBe('https://sandbox.polar.sh/portal/session');
  });

  it('fetchAccountState selects primary subscription, detects duplicates, and leaves paymentMethod undefined', async () => {
    const fetchMock = mock(async () =>
      jsonResponse(200, {
        id: 'cus_3',
        external_id: 'ba_3',
        active_subscriptions: [
          { id: 'sub_old', status: 'active', current_period_end: '2026-12-01T00:00:00Z' },
          { id: 'sub_new', status: 'active', current_period_end: '2026-12-31T00:00:00Z' },
        ],
      }),
    );

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const state = await client.fetchAccountState({
      accountId: 'ba_3',
      externalCustomerId: 'cus_3',
    });
    expect(state.status).toBe(BillingAccountStatus.active);
    expect(state.externalSubscriptionId).toBe('sub_new');
    expect(state.duplicateSubscriptionIds).toEqual(['sub_old']);
    expect(state.paymentMethod).toBeUndefined();
  });

  it('fetchAccountState falls back to /v1/subscriptions when active_subscriptions is empty so pastDue is preserved', async () => {
    const calls: string[] = [];
    const fetchMock = mock(async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/v1/customers/external/ba_pd/state')) {
        return jsonResponse(200, { id: 'cus_pd', external_id: 'ba_pd', active_subscriptions: [] });
      }
      if (url.includes('/v1/subscriptions/?customer_id=cus_pd')) {
        return jsonResponse(200, {
          items: [{ id: 'sub_pd', status: 'past_due', current_period_end: '2026-12-15T00:00:00Z' }],
        });
      }
      return jsonResponse(404, {});
    });

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const state = await client.fetchAccountState({
      accountId: 'ba_pd',
      externalCustomerId: 'cus_pd',
    });
    expect(state.status).toBe(BillingAccountStatus.pastDue);
    expect(state.externalSubscriptionId).toBe('sub_pd');
    expect(calls).toHaveLength(2);
  });

  it('updateCustomer updates customer name and team owner member email', async () => {
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchMock = mock(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      requests.push({ url, method, body });
      if (method === 'PATCH' && url.includes('/v1/customers/cus_upd')) {
        return jsonResponse(200, { id: 'cus_upd' });
      }
      if (method === 'GET' && url.includes('/v1/members/?customer_id=cus_upd')) {
        return jsonResponse(200, {
          items: [{ id: 'mem_owner', role: 'owner', external_id: 'ba_upd:owner' }],
        });
      }
      if (method === 'PATCH' && url.includes('/v1/members/mem_owner')) {
        return jsonResponse(200, { id: 'mem_owner', email: 'new@acme.com' });
      }
      return jsonResponse(404, {});
    });

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    await client.updateCustomer({
      accountId: 'ba_upd',
      externalCustomerId: 'cus_upd',
      name: 'Acme Renamed',
      billingEmail: 'new@acme.com',
    });

    expect(requests).toEqual([
      {
        url: 'https://sandbox-api.polar.sh/v1/customers/cus_upd',
        method: 'PATCH',
        body: { name: 'Acme Renamed' },
      },
      {
        url: 'https://sandbox-api.polar.sh/v1/members/?customer_id=cus_upd',
        method: 'GET',
        body: undefined,
      },
      {
        url: 'https://sandbox-api.polar.sh/v1/members/mem_owner',
        method: 'PATCH',
        body: { email: 'new@acme.com', name: 'Acme Renamed' },
      },
    ]);
  });

  it('ingestUsageEvents counts inserted and duplicates as accepted and flags 5xx as retryable', async () => {
    let call = 0;
    const fetchMock = mock(async () => {
      call += 1;
      if (call === 1) return jsonResponse(200, { inserted: 1, duplicates: 1 });
      return jsonResponse(503, { error: 'unavailable' });
    });

    const client = createPolarBillingClient({
      apiKey: 'test_key',
      sandbox: true,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    const ok = await client.ingestUsageEvents([
      {
        idempotencyKey: 'evt_1',
        accountId: 'ba_1',
        externalCustomerId: 'cus_1',
        meterName: 'computeCpuSeconds',
        value: '12.5',
        occurredAt: new Date('2026-11-22T12:00:00Z'),
      },
      {
        idempotencyKey: 'evt_2',
        accountId: 'ba_1',
        externalCustomerId: 'cus_1',
        meterName: 'computeCpuSeconds',
        value: 5,
        occurredAt: new Date('2026-11-22T12:01:00Z'),
      },
    ]);
    expect(ok).toEqual({ accepted: 2, rejected: [] });

    const fail = await client.ingestUsageEvents([
      {
        idempotencyKey: 'evt_3',
        accountId: 'ba_1',
        externalCustomerId: 'cus_1',
        meterName: 'computeCpuSeconds',
        value: 1,
        occurredAt: new Date('2026-11-22T12:02:00Z'),
      },
    ]);
    expect(fail.accepted).toBe(0);
    expect(fail.rejected).toHaveLength(1);
    expect(fail.rejected[0].retryable).toBe(true);
  });

  it('parseWebhook verifies Standard Webhooks signature case-insensitively and rejects tampered or stale payloads', async () => {
    const secret = `whsec_${Buffer.from('super-secret-polar-key').toString('base64')}`;
    const client = createPolarBillingClient({ webhookSecret: secret });
    const now = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 'customer.state_changed',
      data: {
        id: 'cus_99',
        external_id: 'ba_99',
        active_subscriptions: [{ id: 'sub_99', status: 'past_due', cancel_at_period_end: false }],
      },
    });
    const sig = signStandardWebhook(secret, 'msg_1', now, body);

    const parsed = await client.parseWebhook({
      rawBody: body,
      headers: {
        'Webhook-Id': 'msg_1',
        'WEBHOOK-TIMESTAMP': now,
        'webhook-signature': sig,
      },
    });

    expect(parsed.kind).toBe('accountStateChanged');
    if (parsed.kind === 'accountStateChanged') {
      expect(parsed.accountId).toBe('ba_99');
      expect(parsed.state.status).toBe(BillingAccountStatus.pastDue);
      expect(parsed.state.paymentMethod).toBeUndefined();
    }

    await expect(
      client.parseWebhook({
        rawBody: `${body} `,
        headers: { 'webhook-id': 'msg_1', 'webhook-timestamp': now, 'webhook-signature': sig },
      }),
    ).rejects.toThrow(/signature/i);

    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const oldSig = signStandardWebhook(secret, 'msg_2', oldTs, body);
    await expect(
      client.parseWebhook({
        rawBody: body,
        headers: { 'webhook-id': 'msg_2', 'webhook-timestamp': oldTs, 'webhook-signature': oldSig },
      }),
    ).rejects.toThrow(/tolerance/i);
  });
});
