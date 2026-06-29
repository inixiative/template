/**
 * @atlas
 * @kind middleware
 * @partOf feature:auth
 * @uses primitive:appEvents
 */

import { Integration } from '@template/db/generated/client/enums';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import type { Context, Next } from 'hono';
import type { AppEnv } from '#/types/appEnv';

const isIntegration = (value: string | undefined): value is Integration =>
  !!value && (Object.values(Integration) as string[]).includes(value);

export const auditActorMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  const spoofedBy = c.get('spoofedBy');
  const token = c.get('token');
  const originHeader = c.req.header('x-origin-integration');

  const actor = {
    actorUserId: user?.id ?? null,
    actorSpoofUserId: spoofedBy?.id ?? null,
    actorTokenId: token?.id ?? null,
    actorJobName: null,
    ipAddress: (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || c.req.header('x-real-ip') || null,
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
    originIntegration: isIntegration(originHeader) ? originHeader : null,
  };

  return auditActorContext.scope(actor, () => next());
};
