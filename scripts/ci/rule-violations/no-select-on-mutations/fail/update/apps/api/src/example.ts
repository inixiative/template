import { db } from '@template/db';

// Forbidden: select narrows the update result the lifecycle hooks consume.
export async function rename(id: string, name: string) {
  return db.token.update({ where: { id }, data: { name }, select: { id: true, name: true } });
}
