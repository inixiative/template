import { db } from '@template/db';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
export const handler = async (id: string) => {
  const token = await db.token.findUnique({ where: { id }, include: { targetEntitlements: { where: { deletedAt: null } } } });
  const held = await db.entitlement.findMany({ where: { targetId: id } });
  await changeEntitlements([], []);
  return { token, held };
};
