import { db } from '@template/db';

// Allowed: the write's own args carry no top-level select/omit. A `select` nested under
// a relation read inside `include` is at depth > 1, so it must not be flagged.
export async function createWithRelation(organizationId: string) {
  return db.token.create({
    data: { organizationId, name: 'ci' },
    include: { organization: { select: { id: true } } },
  });
}
