import { describe, expect, it } from 'bun:test';
import { reachableFrom } from '@inixiative/permissions';
import { rebacSchema } from '@template/permissions/rebac/schema';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const standardActions: string[] = roleHierarchy.map(roleToStandardAction);

const notStandard: Partial<Record<string, string[]>> = {
  'db:contact': ['read → own', 'operate → own', 'manage → own'],
  'db:organizationUser': ['operate → manage', 'operate → own'],
  'db:spaceUser': ['operate → manage', 'operate → own'],
};

describe('on every resource, each standard action reaches every higher one it defines, unless the model declares otherwise (R105)', () => {
  for (const [resource, permission] of Object.entries(rebacSchema.permissions)) {
    const defined = standardActions.filter((action) => permission?.actions[action] !== undefined);
    it(resource, () => {
      const unreached = defined.flatMap((action, rank) =>
        defined
          .slice(rank + 1)
          .filter((higher) => !reachableFrom(rebacSchema, resource, action).has(higher))
          .map((higher) => `${action} → ${higher}`),
      );
      expect(unreached).toEqual(notStandard[resource] ?? []);
    });
  }
});
