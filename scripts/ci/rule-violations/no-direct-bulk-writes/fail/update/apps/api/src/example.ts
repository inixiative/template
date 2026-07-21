import { db } from '@template/db';

export async function deactivate(organizationId: string) {
  // Forbidden: bare updateMany skips per-row hooks.
  await db.token.updateMany({ where: { organizationId }, data: { name: 'revoked' } });
}
