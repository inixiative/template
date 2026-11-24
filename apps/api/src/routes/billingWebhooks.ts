/**
 * @atlas
 * @kind route
 * @partOf feature:billing
 * @uses infrastructure:billing, infrastructure:prisma, primitive:errors
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { db, type Prisma } from '@template/db';
import type { BillingWebhookEvent } from '@template/db/generated/client/client';
import {
  BillingAccountStatus,
  BillingProvider,
  BillingWebhookEventStatus,
} from '@template/db/generated/client/enums';
import { bodyLimit } from 'hono/body-limit';
import { billingClientForProviderOrThrow, billingRegistry } from '#/lib/billing';
import { makeError } from '#/lib/errors';
import { rateLimit } from '#/middleware/rateLimit/rateLimit';
import { globalRateLimitKey, ipRateLimitKey } from '#/middleware/rateLimit/rateLimitKeys';
import { applyBillingAccountState } from '#/modules/billingAccount/services/applyBillingAccountState';
import type { AppEnv } from '#/types/appEnv';

const STALE_PENDING_MS = 60_000;

export const billingWebhooksRouter = new OpenAPIHono<AppEnv>();

billingWebhooksRouter.use('*', bodyLimit({ maxSize: 256 * 1024 }));
billingWebhooksRouter.use(
  '*',
  rateLimit([
    { scope: 'billingWebhook:ip', windowMs: 60_000, max: 120, key: ipRateLimitKey },
    { scope: 'billingWebhook:global', windowMs: 60_000, max: 2_000, key: globalRateLimitKey },
  ]),
);

const claimWebhookEvent = async (
  provider: BillingProvider,
  externalEventId: string,
  eventType: string,
  payload: Prisma.InputJsonValue,
): Promise<
  { action: 'process'; eventId: string } | { action: 'alreadyHandled' } | { action: 'inFlight' }
> => {
  const now = new Date();
  return db.txn(async () => {
    const [existing] = await db.findForUpdate<BillingWebhookEvent>(
      'BillingWebhookEvent',
      { provider, externalEventId },
      { upserting: true },
    );

    if (!existing) {
      const created = await db.billingWebhookEvent.create({
        data: {
          provider,
          externalEventId,
          eventType,
          status: BillingWebhookEventStatus.pending,
          claimedAt: now,
          attempts: 1,
          payload,
        },
      });
      return { action: 'process', eventId: created.id };
    }

    if (
      existing.status === BillingWebhookEventStatus.processed ||
      existing.status === BillingWebhookEventStatus.ignored
    ) {
      return { action: 'alreadyHandled' };
    }

    const isStalePending =
      existing.status === BillingWebhookEventStatus.pending &&
      existing.claimedAt !== null &&
      now.getTime() - existing.claimedAt.getTime() > STALE_PENDING_MS;

    if (existing.status === BillingWebhookEventStatus.failed || isStalePending) {
      await db.billingWebhookEvent.update({
        where: { id: existing.id },
        data: {
          status: BillingWebhookEventStatus.pending,
          claimedAt: now,
          attempts: { increment: 1 },
          error: null,
        },
      });
      return { action: 'process', eventId: existing.id };
    }

    return { action: 'inFlight' };
  });
};

billingWebhooksRouter.post('/:provider', async (c) => {
  const providerParam = c.req.param('provider');
  if (
    !Object.values(BillingProvider).includes(providerParam as BillingProvider) ||
    !billingRegistry.has(providerParam)
  ) {
    throw makeError({ status: 404, message: `Unknown billing provider: ${providerParam}` });
  }
  const provider = providerParam as BillingProvider;
  const client = billingClientForProviderOrThrow(provider);
  const rawBody = await c.req.text();

  const normalized = await client.parseWebhook({
    rawBody,
    headers: c.req.raw.headers,
  });

  const claim = await claimWebhookEvent(
    provider,
    normalized.externalEventId,
    normalized.rawEventType,
    normalized.rawPayload as Prisma.InputJsonValue,
  );
  if (claim.action === 'alreadyHandled') return c.json({ status: 'ok' }, 200);
  if (claim.action === 'inFlight') return c.json({ status: 'retry' }, 503);

  try {
    if (normalized.kind === 'ignored') {
      await db.billingWebhookEvent.update({
        where: { id: claim.eventId },
        data: {
          status: BillingWebhookEventStatus.ignored,
          processedAt: new Date(),
        },
      });
      return c.json({ status: 'ok' }, 200);
    }

    const account = await db.billingAccount.findFirst({
      where: {
        provider,
        deletedAt: null,
        OR: [
          ...(normalized.accountId ? [{ id: normalized.accountId }] : []),
          { externalCustomerId: normalized.externalCustomerId },
        ],
      },
    });

    if (!account) {
      await db.billingWebhookEvent.update({
        where: { id: claim.eventId },
        data: {
          status: BillingWebhookEventStatus.ignored,
          processedAt: new Date(),
        },
      });
      return c.json({ status: 'ok' }, 200);
    }

    if (normalized.kind !== 'accountStateChanged') {
      await db.billingWebhookEvent.update({
        where: { id: claim.eventId },
        data: {
          status: BillingWebhookEventStatus.ignored,
          billingAccountId: account.id,
          processedAt: new Date(),
        },
      });
      return c.json({ status: 'ok' }, 200);
    }

    await applyBillingAccountState(account, normalized.state, {
      resolveState: async (current) => {
        // why: Standard Webhooks timestamps have 1-second resolution, so allow a 2s skew before refetching
        const isStale =
          current.lastSyncedAt !== null &&
          normalized.occurredAt.getTime() + 2_000 < current.lastSyncedAt.getTime();
        const isSubscriptionMismatch =
          normalized.rawEventType.startsWith('subscription.') &&
          current.externalSubscriptionId !== null &&
          normalized.state.externalSubscriptionId !== current.externalSubscriptionId;
        const isAmbiguousEmptyCustomerState =
          normalized.rawEventType === 'customer.state_changed' &&
          normalized.state.status === BillingAccountStatus.incomplete &&
          current.status !== BillingAccountStatus.incomplete;

        if (isStale || isSubscriptionMismatch || isAmbiguousEmptyCustomerState) {
          return client.fetchAccountState({
            accountId: current.id,
            externalCustomerId: normalized.externalCustomerId,
          });
        }
        return normalized.state;
      },
    });

    await db.billingWebhookEvent.update({
      where: { id: claim.eventId },
      data: {
        status: BillingWebhookEventStatus.processed,
        billingAccountId: account.id,
        processedAt: new Date(),
      },
    });
    return c.json({ status: 'ok' }, 200);
  } catch (err) {
    await db.billingWebhookEvent.update({
      where: { id: claim.eventId },
      data: {
        status: BillingWebhookEventStatus.failed,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
});
