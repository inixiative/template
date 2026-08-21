import { db } from '@template/db';

export async function seedContacts(userId: string, organizationId: string) {
  await db.contact.createManyAndReturn({ data: [{ userId, type: 'email', value: 'a@example.com' }] });
  await db.token.updateManyAndReturn({ where: { organizationId }, data: { name: 'revoked' } });
}
