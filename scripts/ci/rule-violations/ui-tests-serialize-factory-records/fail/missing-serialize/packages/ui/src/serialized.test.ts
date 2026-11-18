import { buildOrganization } from '@template/db/test';

it('does not serialize factory entity', async () => {
  const { entity } = await buildOrganization();
  expect(entity).toBeDefined();
});
