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
    actorUserId: (user ?? token?.user)?.id ?? null,
    actorSpoofUserId: spoofedBy?.id ?? null,
    actorTokenId: token?.id ?? null,
    actor: token
      ? {
          token: {
            id: token.id,
            name: token.name,
            keyPrefix: token.keyPrefix,
            ownerModel: token.ownerModel,
            userId: token.userId,
            organizationId: token.organizationId,
            spaceId: token.spaceId,
            integrationId: token.integrationId,
          },
        }
      : null,
    actorJobName: null,
    ipAddress: clientAddress(c),
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
    integrationId: token?.integrationId ?? null,
    bypassSoftDeleteScope: false,
  };

  return auditActorContext.scope(actor, () => next());
};
