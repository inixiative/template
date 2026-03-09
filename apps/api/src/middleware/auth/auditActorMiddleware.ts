import type { Context, Next } from 'hono';
import { auditActorContext } from '#/lib/auditActorContext';
import type { AppEnv } from '#/types/appEnv';

export const auditActorMiddleware = async (c: Context<AppEnv>, next: Next) => {
  const user = c.get('user');
  const spoofedBy = c.get('spoofedBy');
  const token = c.get('token');

  const actor = {
    actorUserId: user?.id ?? null,
    actorSpoofUserId: spoofedBy?.id ?? null,
    actorTokenId: token?.id ?? null,
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
    sourceInquiryId: null,
  };

  return auditActorContext.run(actor, () => next());
};
