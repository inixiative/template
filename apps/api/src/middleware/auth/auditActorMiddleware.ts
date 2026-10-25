/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:appEvents, feature:integrations
 */

import { auditActorContext } from '@template/db/lib/auditActorContext';
import type { Context, Next } from 'hono';
import { clientAddress } from '#/lib/clientIp';
import type { AppEnv } from '#/types/appEnv';

export const auditActorMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  const spoofedBy = c.get('spoofedBy');
  const token = c.get('token');

  const actor = {
    actorUserId: user?.id ?? null,
    actorSpoofUserId: spoofedBy?.id ?? null,
    actorTokenId: token?.id ?? null,
    actorTokenName: token?.name ?? null,
    actorTokenKeyPrefix: token?.keyPrefix ?? null,
    actorJobName: null,
    ipAddress: clientAddress(c),
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
    integrationId: token?.integrationId ?? null,
    bypassSoftDeleteScope: false,
  };

  return auditActorContext.scope(actor, () => next());
};
