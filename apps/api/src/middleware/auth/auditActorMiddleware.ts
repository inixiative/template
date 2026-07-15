/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:appEvents, feature:integrations
 */

import { auditActorContext } from '@template/db/lib/auditActorContext';
import { log } from '@template/shared/logger';
import type { Context, Next } from 'hono';
import { findOwnedIntegration } from '#/modules/integration/services/findOwnedIntegration';
import type { AppEnv } from '#/types/appEnv';

const resolveOriginIntegrationId = async (c: Context<AppEnv>): Promise<string | null> => {
  const boundIntegrationId = c.get('token')?.integrationId ?? null;
  if (boundIntegrationId) return boundIntegrationId;

  const asserted = c.req.header('x-integration-id');
  if (!asserted) return null;

  const owned = await findOwnedIntegration(asserted, {
    userId: c.get('user')?.id ?? null,
    organizationIds: (c.get('organizations') ?? []).map((o) => o.id),
    spaceIds: (c.get('spaces') ?? []).map((s) => s.id),
  });
  if (owned) return owned.id;

  log.warn('x-integration-id not owned by the request principal — ignoring', { assertedIntegrationId: asserted });
  return null;
};

export const auditActorMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  const spoofedBy = c.get('spoofedBy');
  const token = c.get('token');

  const actor = {
    actorUserId: user?.id ?? null,
    actorSpoofUserId: spoofedBy?.id ?? null,
    actorTokenId: token?.id ?? null,
    actorJobName: null,
    ipAddress: (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || c.req.header('x-real-ip') || null,
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
    integrationId: await resolveOriginIntegrationId(c),
  };

  return auditActorContext.scope(actor, () => next());
};
