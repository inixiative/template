import { describe, expect, it } from 'bun:test';
import { Role } from '@template/db/generated/client/enums';
import { ROLES } from '@template/shared/auth/roles';

describe('shared enum mirrors', () => {
  it('ROLES lists exactly the Prisma Role values, in order', () => {
    expect([...ROLES]).toEqual(Object.values(Role));
  });
});
