import { db } from '@template/db';

export async function seedContacts(userId: string) {
  // Forbidden: bare createMany skips per-row hooks.
  await db.contact.createMany({ data: [{ userId, type: 'email', value: 'a@example.com' }] });
}
