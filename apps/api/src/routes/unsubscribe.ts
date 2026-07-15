/**
 * @atlas
 * @kind route
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '@template/db';
import { verifyUnsubscribe } from '#/lib/email/unsubscribe';
import { makeError } from '#/lib/errors';
import type { AppEnv } from '#/types/appEnv';

export const unsubscribeRouter = new OpenAPIHono<AppEnv>();

// One-click unsubscribe (RFC 8058). POST-only on purpose: a GET prefetch (scanners, Safe Links,
// hover previews) must never unsubscribe anyone. The signed token binds (user, contact, kind), so the
// link can only drop that one kind for that one contact. Idempotent; never leaks contact existence.
unsubscribeRouter.post('/', async (c) => {
  const claim = verifyUnsubscribe(c.req.query('token') ?? '');
  if (!claim) throw makeError({ status: 400, message: 'Invalid unsubscribe token' });

  const contact = await db.contact.findUnique({
    where: { id: claim.contactId },
    select: { id: true, userId: true, acceptedKinds: true },
  });
  const owns = !claim.userId || contact?.userId === claim.userId;
  if (contact && owns && contact.acceptedKinds.includes(claim.kind)) {
    await db.contact.update({
      where: { id: contact.id },
      data: { acceptedKinds: { set: contact.acceptedKinds.filter((k) => k !== claim.kind) } },
    });
  }
  return c.json({ status: 'ok' });
});
