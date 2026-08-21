import { db } from '@template/db';

// Allowed: select on reads is fine — the hazard is exclusively writes.
export async function listNames(organizationId: string) {
  const tokens = await db.token.findMany({ where: { organizationId }, select: { id: true, name: true } });
  const one = await db.token.findFirst({ where: { organizationId }, select: { id: true } });
  return { tokens, one };
}
