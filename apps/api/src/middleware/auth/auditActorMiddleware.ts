/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:appEvents, feature:integrations
 */

import { auditActorContext } from '@template/db/lib/auditActorContext';
import type { Context, Next } from 'hono';
import { pick } from 'lodash-es';
import { clientAddress } from '#/lib/clientIp';
import { me } from '#/lib/context/me';
import type { AppEnv } from '#/types/appEnv';

export const auditActorMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const token = c.get('token');
  const acting = c.get('permix').getActor();

  const actor = {
    actorUserId: me(c)?.id ?? token?.userId ?? null,
    actorSpoofUserId: c.get('spoofedBy')?.id ?? null,
    actorTokenId: token?.id ?? null,
    actor:
      acting?.model === 'User'
        ? { model: acting.model, record: pick(acting.record, ['id', 'platformRole']) }
        : acting,
    actorJobName: null,
    ipAddress: clientAddress(c),
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
    integrationId: token?.integrationId ?? null,
    bypassSoftDeleteScope: false,
  };

  return auditActorContext.scope(actor, () => next());
};
