import { describe, expect, it } from 'bun:test';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';

describe('tenantPermissionRulesSchema: a key that is no resource the tenant may extend', () => {
  const schema = tenantPermissionRulesSchema('Organization');

  for (const [what, key] of [
    ['a model that does not exist', 'db:Bogus'],
    ['a name with no map', 'garbage'],
    ['a resource spelled as its accessor', 'db:organization'],
  ] as const)
    it(`${what} is refused as a validation issue, never thrown`, () => {
      const parsed = schema.safeParse({ [key]: {} });
      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.map((issue) => issue.message).join()).toMatch(
        /not something a Organization may extend/,
      );
    });
});
