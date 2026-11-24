/**
 * @atlas
 * @kind adapter
 * @partOf infrastructure:billing
 * @uses primitive:errors
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BillingAccountStatus, BillingProvider } from '@template/db/generated/client/enums';
import { chunk } from 'lodash-es';
import type {
  BillingClient,
  BillingUsageEventInput,
  NormalizedAccountState,
  NormalizedBillingWebhookEvent,
  ParseWebhookInput,
} from '#/lib/billing/types';
import { makeError } from '#/lib/errors';

const POLAR_API_BASE = 'https://api.polar.sh';
const POLAR_SANDBOX_API_BASE = 'https://sandbox-api.polar.sh';
const WEBHOOK_TOLERANCE_SECONDS = 300;
const USAGE_INGEST_BATCH_SIZE = 100;

export type PolarBillingConfig = {
  apiKey?: string;
  webhookSecret?: string;
  sandbox?: boolean;
  payAsYouGoProductId?: string;
  planProductIds?: Readonly<Record<string, string>>;
  fetchFn?: typeof fetch;
};

type PolarSubscriptionPayload = {
  id: string;
  status: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  customer_id?: string;
  customer?: { id?: string; external_id?: string | null } | null;
};

type PolarCustomerStatePayload = {
  id: string;
  external_id?: string | null;
  active_subscriptions?: PolarSubscriptionPayload[];
};

const ownerExternalIdForAccount = (accountId: string): string => `${accountId}:owner`;

const parseOptionalDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapPolarSubscriptionStatus = (status: string): BillingAccountStatus => {
  switch (status) {
    case 'active':
    case 'trialing':
      return BillingAccountStatus.active;
    case 'past_due':
      return BillingAccountStatus.pastDue;
    case 'incomplete_expired':
    case 'unpaid':
      return BillingAccountStatus.expired;
    case 'canceled':
    case 'revoked':
      return BillingAccountStatus.canceled;
    default:
      return BillingAccountStatus.incomplete;
  }
};

const statusPriority = (status: BillingAccountStatus): number => {
  switch (status) {
    case BillingAccountStatus.active:
      return 5;
    case BillingAccountStatus.pastDue:
      return 4;
    case BillingAccountStatus.incomplete:
      return 3;
    case BillingAccountStatus.expired:
      return 2;
    case BillingAccountStatus.canceled:
      return 1;
  }
};

const normalizePolarSubscriptions = (
  externalCustomerId: string,
  subscriptions: readonly PolarSubscriptionPayload[],
): NormalizedAccountState => {
  if (subscriptions.length === 0) {
    return {
      externalCustomerId,
      externalSubscriptionId: null,
      status: BillingAccountStatus.incomplete,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      paymentMethod: undefined,
    };
  }

  const ranked = [...subscriptions].sort((a, b) => {
    const scoreDiff =
      statusPriority(mapPolarSubscriptionStatus(b.status)) -
      statusPriority(mapPolarSubscriptionStatus(a.status));
    if (scoreDiff !== 0) return scoreDiff;
    const endA = parseOptionalDate(a.current_period_end)?.getTime() ?? 0;
    const endB = parseOptionalDate(b.current_period_end)?.getTime() ?? 0;
    if (endB !== endA) return endB - endA;
    return b.id.localeCompare(a.id);
  });

  const primary = ranked[0];
  const duplicates = ranked
    .slice(1)
    .filter((sub) => mapPolarSubscriptionStatus(sub.status) === BillingAccountStatus.active)
    .map((sub) => sub.id);

  return {
    externalCustomerId,
    externalSubscriptionId: primary.id,
    status: mapPolarSubscriptionStatus(primary.status),
    currentPeriodStart: parseOptionalDate(primary.current_period_start),
    currentPeriodEnd: parseOptionalDate(primary.current_period_end),
    cancelAtPeriodEnd: Boolean(primary.cancel_at_period_end),
    paymentMethod: undefined,
    duplicateSubscriptionIds: duplicates.length > 0 ? duplicates : undefined,
  };
};

const readHeaderCaseInsensitive = (
  headers: ParseWebhookInput['headers'],
  name: string,
): string | undefined => {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
};

const decodeWebhookSecret = (secret: string): Buffer => {
  const trimmed = secret.trim();
  if (trimmed.startsWith('whsec_')) {
    return Buffer.from(trimmed.slice('whsec_'.length), 'base64');
  }
  return Buffer.from(trimmed, 'utf8');
};

const verifyStandardWebhookSignature = (
  secret: string,
  webhookId: string,
  webhookTimestamp: string,
  webhookSignature: string,
  rawBody: string,
): Date => {
  const tsSeconds = Number(webhookTimestamp);
  if (!Number.isFinite(tsSeconds)) {
    throw makeError({ status: 401, message: 'Invalid webhook timestamp header' });
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    throw makeError({ status: 401, message: 'Webhook timestamp outside tolerance window' });
  }

  const key = decodeWebhookSecret(secret);
  const signedPayload = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', key).update(signedPayload).digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf8');

  const candidates = webhookSignature
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const matched = candidates.some((candidate) => {
    const commaIdx = candidate.indexOf(',');
    if (commaIdx === -1) return false;
    const version = candidate.slice(0, commaIdx);
    const sig = candidate.slice(commaIdx + 1);
    if (version !== 'v1') return false;
    const sigBuf = Buffer.from(sig, 'utf8');
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  });

  if (!matched) {
    throw makeError({ status: 401, message: 'Invalid billing webhook signature' });
  }

  return new Date(tsSeconds * 1000);
};

export const createPolarBillingClient = (config: PolarBillingConfig): BillingClient => {
  const baseUrl = config.sandbox ? POLAR_SANDBOX_API_BASE : POLAR_API_BASE;
  const fetchImpl = config.fetchFn ?? fetch;

  const requireApiKey = (): string => {
    if (!config.apiKey) {
      throw makeError({
        status: 503,
        message: 'Polar billing is not configured (missing API key)',
      });
    }
    return config.apiKey;
  };

  const polarRequest = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> => {
    const apiKey = requireApiKey();
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const isJson = response.headers.get('content-type')?.includes('json') ?? false;
    const parsed = text.length === 0 ? null : isJson ? JSON.parse(text) : text;

    return { status: response.status, data: parsed as T };
  };

  const throwProviderError = (action: string, status: number, data: unknown): never => {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? JSON.stringify((data as { detail: unknown }).detail)
        : String(data ?? status);
    if (status === 422 && detail.toLowerCase().includes('already exists')) {
      throw makeError({
        status: 409,
        message: `Polar ${action} conflict: ${detail}`,
      });
    }
    throw makeError({
      status: status >= 500 ? 502 : 422,
      message: `Polar ${action} failed (${status}): ${detail}`,
    });
  };

  return {
    provider: BillingProvider.polar,
    // why: using Polar `type: 'team'` customers with an `owner` member allows multiple BillingAccounts to share one billingEmail
    capabilities: {
      requiresUniqueEmail: false,
      supportsPreAuthPortal: true,
      supportsMeteredUsage: true,
    },

    ensureCustomer: async (input) => {
      const existing = await polarRequest<{ id: string }>(
        'GET',
        `/v1/customers/external/${encodeURIComponent(input.accountId)}`,
      );
      if (existing.status === 200 && existing.data?.id) {
        return { externalCustomerId: existing.data.id };
      }

      const created = await polarRequest<{ id: string }>('POST', '/v1/customers/', {
        external_id: input.accountId,
        name: input.name,
        type: 'team',
        owner: {
          email: input.billingEmail,
          name: input.name,
          external_id: ownerExternalIdForAccount(input.accountId),
        },
        metadata: input.metadata,
      });

      if (created.status === 201 && created.data?.id) {
        return { externalCustomerId: created.data.id };
      }
      return throwProviderError('ensureCustomer', created.status, created.data);
    },

    updateCustomer: async (input) => {
      if (input.name !== undefined) {
        const res = await polarRequest(
          'PATCH',
          `/v1/customers/${encodeURIComponent(input.externalCustomerId)}`,
          { name: input.name },
        );
        if (res.status !== 200) throwProviderError('updateCustomer', res.status, res.data);
      }

      if (input.billingEmail !== undefined || input.name !== undefined) {
        const members = await polarRequest<{
          items?: Array<{ id: string; role?: string; external_id?: string | null }>;
        }>('GET', `/v1/members/?customer_id=${encodeURIComponent(input.externalCustomerId)}`);
        if (members.status !== 200) {
          throwProviderError('updateCustomer.listMembers', members.status, members.data);
        }
        const ownerMember = members.data?.items?.find((m) => m.role === 'owner');
        if (ownerMember) {
          const memberPatch: Record<string, string> = {};
          if (input.billingEmail !== undefined) memberPatch.email = input.billingEmail;
          if (input.name !== undefined) memberPatch.name = input.name;
          const patched = await polarRequest(
            'PATCH',
            `/v1/members/${encodeURIComponent(ownerMember.id)}`,
            memberPatch,
          );
          if (patched.status !== 200) {
            throwProviderError('updateCustomer.patchOwnerMember', patched.status, patched.data);
          }
        }
      }
    },

    createSetupSession: async (input) => {
      const productId = input.planKey
        ? config.planProductIds?.[input.planKey]
        : config.payAsYouGoProductId;
      if (!productId) {
        throw makeError({
          status: 503,
          message: input.planKey
            ? `Polar product ID is not configured for plan '${input.planKey}'`
            : 'Polar pay-as-you-go product ID is not configured',
        });
      }

      const res = await polarRequest<{
        id: string;
        url: string;
        expires_at?: string | null;
      }>('POST', '/v1/checkouts/', {
        products: [productId],
        external_customer_id: input.accountId,
        success_url: input.successUrl,
        return_url: input.returnUrl,
        metadata: input.metadata,
      });

      if (res.status !== 201 || !res.data?.url) {
        throwProviderError('createSetupSession', res.status, res.data);
      }

      return {
        url: res.data.url,
        externalSessionId: res.data.id,
        expiresAt: parseOptionalDate(res.data.expires_at),
      };
    },

    createPortalSession: async (input) => {
      const res = await polarRequest<{ customer_portal_url: string }>(
        'POST',
        '/v1/customer-sessions/',
        {
          external_customer_id: input.accountId,
          external_member_id: ownerExternalIdForAccount(input.accountId),
          return_url: input.returnUrl,
        },
      );

      if (res.status !== 201 || !res.data?.customer_portal_url) {
        throwProviderError('createPortalSession', res.status, res.data);
      }

      return { url: res.data.customer_portal_url };
    },

    cancelAccount: async (input) => {
      if (input.externalSubscriptionId) {
        const res = input.immediate
          ? await polarRequest(
              'DELETE',
              `/v1/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}`,
            )
          : await polarRequest(
              'PATCH',
              `/v1/subscriptions/${encodeURIComponent(input.externalSubscriptionId)}`,
              { cancel_at_period_end: true },
            );
        if (res.status !== 200 && res.status !== 204 && res.status !== 404) {
          throwProviderError('cancelAccount', res.status, res.data);
        }
      }

      if (input.releaseCustomer) {
        const res = await polarRequest(
          'DELETE',
          `/v1/customers/external/${encodeURIComponent(input.accountId)}`,
        );
        if (res.status !== 204 && res.status !== 200 && res.status !== 404) {
          throwProviderError('releaseCustomer', res.status, res.data);
        }
      }

      return { status: BillingAccountStatus.canceled };
    },

    fetchAccountState: async (input) => {
      const stateRes = await polarRequest<PolarCustomerStatePayload>(
        'GET',
        `/v1/customers/external/${encodeURIComponent(input.accountId)}/state`,
      );
      if (stateRes.status === 404) {
        return {
          externalCustomerId: input.externalCustomerId,
          externalSubscriptionId: null,
          status: BillingAccountStatus.canceled,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          paymentMethod: undefined,
        };
      }
      if (stateRes.status !== 200 || !stateRes.data?.id) {
        throwProviderError('fetchAccountState', stateRes.status, stateRes.data);
      }

      const activeSubs = stateRes.data.active_subscriptions ?? [];
      if (activeSubs.length > 0) {
        return normalizePolarSubscriptions(stateRes.data.id, activeSubs);
      }

      const allSubsRes = await polarRequest<{ items?: PolarSubscriptionPayload[] }>(
        'GET',
        `/v1/subscriptions/?customer_id=${encodeURIComponent(stateRes.data.id)}&limit=100`,
      );
      if (allSubsRes.status === 200 && Array.isArray(allSubsRes.data?.items)) {
        return normalizePolarSubscriptions(stateRes.data.id, allSubsRes.data.items);
      }

      return normalizePolarSubscriptions(stateRes.data.id, activeSubs);
    },

    ingestUsageEvents: async (events: readonly BillingUsageEventInput[]) => {
      let accepted = 0;
      const rejected: Array<{ idempotencyKey: string; reason: string; retryable: boolean }> = [];

      for (const batch of chunk(events, USAGE_INGEST_BATCH_SIZE)) {
        const res = await polarRequest<{ inserted?: number; duplicates?: number }>(
          'POST',
          '/v1/events/ingest',
          {
            events: batch.map((event) => ({
              external_id: event.idempotencyKey,
              name: event.meterName,
              external_customer_id: event.accountId,
              timestamp: event.occurredAt.toISOString(),
              metadata: {
                ...(event.metadata ?? {}),
                value: typeof event.value === 'string' ? Number(event.value) : event.value,
              },
            })),
          },
        );

        if (res.status === 200) {
          accepted += (res.data?.inserted ?? 0) + (res.data?.duplicates ?? 0);
          continue;
        }

        const retryable = res.status >= 500 || res.status === 429;
        const reason = `Polar events/ingest failed (${res.status})`;
        for (const event of batch) {
          rejected.push({ idempotencyKey: event.idempotencyKey, reason, retryable });
        }
      }

      return { accepted, rejected };
    },

    parseWebhook: async (input): Promise<NormalizedBillingWebhookEvent> => {
      if (!config.webhookSecret) {
        throw makeError({
          status: 503,
          message: 'Polar webhook secret is not configured',
        });
      }

      const webhookId = readHeaderCaseInsensitive(input.headers, 'webhook-id');
      const webhookTimestamp = readHeaderCaseInsensitive(input.headers, 'webhook-timestamp');
      const webhookSignature = readHeaderCaseInsensitive(input.headers, 'webhook-signature');

      if (!webhookId || !webhookTimestamp || !webhookSignature) {
        throw makeError({ status: 401, message: 'Missing Standard Webhooks headers' });
      }

      const occurredAt = verifyStandardWebhookSignature(
        config.webhookSecret,
        webhookId,
        webhookTimestamp,
        webhookSignature,
        input.rawBody,
      );

      const parsed = JSON.parse(input.rawBody) as {
        type?: string;
        data?: Record<string, unknown>;
      };
      const rawPayload = parsed as Record<string, unknown>;
      const rawEventType = parsed.type ?? 'unknown';
      const data = parsed.data ?? {};

      if (rawEventType === 'customer.state_changed') {
        const statePayload = data as unknown as PolarCustomerStatePayload;
        if (!statePayload.id) {
          return {
            externalEventId: webhookId,
            rawEventType,
            occurredAt,
            rawPayload,
            kind: 'ignored',
          };
        }
        return {
          externalEventId: webhookId,
          rawEventType,
          occurredAt,
          rawPayload,
          kind: 'accountStateChanged',
          accountId: statePayload.external_id ?? null,
          externalCustomerId: statePayload.id,
          state: normalizePolarSubscriptions(
            statePayload.id,
            statePayload.active_subscriptions ?? [],
          ),
        };
      }

      if (rawEventType.startsWith('subscription.')) {
        const sub = data as unknown as PolarSubscriptionPayload;
        const externalCustomerId = sub.customer_id ?? sub.customer?.id;
        if (!externalCustomerId || !sub.id) {
          return {
            externalEventId: webhookId,
            rawEventType,
            occurredAt,
            rawPayload,
            kind: 'ignored',
          };
        }
        return {
          externalEventId: webhookId,
          rawEventType,
          occurredAt,
          rawPayload,
          kind: 'accountStateChanged',
          accountId: sub.customer?.external_id ?? null,
          externalCustomerId,
          state: normalizePolarSubscriptions(externalCustomerId, [sub]),
        };
      }

      if (rawEventType === 'order.paid') {
        const externalCustomerId =
          (data.customer_id as string | undefined) ??
          (data.customer as { id?: string } | undefined)?.id ??
          undefined;
        const externalInvoiceId = data.id as string | undefined;
        if (!externalCustomerId || !externalInvoiceId) {
          return {
            externalEventId: webhookId,
            rawEventType,
            occurredAt,
            rawPayload,
            kind: 'ignored',
          };
        }
        return {
          externalEventId: webhookId,
          rawEventType,
          occurredAt,
          rawPayload,
          kind: 'paymentSucceeded',
          accountId:
            (data.customer as { external_id?: string | null } | undefined)?.external_id ?? null,
          externalCustomerId,
          externalInvoiceId,
          amountMinorUnits: Number(data.total_amount ?? data.amount ?? 0),
          currency: String(data.currency ?? 'usd'),
          paidAt: parseOptionalDate(data.created_at as string | undefined) ?? occurredAt,
        };
      }

      return {
        externalEventId: webhookId,
        rawEventType,
        occurredAt,
        rawPayload,
        kind: 'ignored',
      };
    },
  };
};
