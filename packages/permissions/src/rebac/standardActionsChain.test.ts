import { describe, expect, it } from 'bun:test';
import { reachableFrom } from '@inixiative/permissions';
import { schemaMap } from '@template/permissions/rebac/schema';
import { roleHierarchy, roleToStandardAction } from '@template/permissions/roles/shared';

const standardActions: string[] = roleHierarchy.map(roleToStandardAction);

const notStandard: Partial<Record<string, string[]>> = {
  'db:Contact': ['read → own', 'operate → own', 'manage → own'],
  'db:OrganizationUser': ['operate → manage', 'operate → own'],
  'db:SpaceUser': ['operate → manage', 'operate → own'],
};

describe('on every resource, each standard action reaches every higher one it defines, unless the model declares otherwise (R105)', () => {
  for (const [resource, permission] of Object.entries(schemaMap.permissions)) {
    const defined = standardActions.filter((action) => permission?.actions[action] !== undefined);
    it(resource, () => {
      const unreached = defined.flatMap((action, rank) =>
        defined
          .slice(rank + 1)
          .filter((higher) => !reachableFrom(schemaMap, resource, action).has(higher))
          .map((higher) => `${action} → ${higher}`),
      );
      expect(unreached).toEqual(notStandard[resource] ?? []);
    });
  }
});
