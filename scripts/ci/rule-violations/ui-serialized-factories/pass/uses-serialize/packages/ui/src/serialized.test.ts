import { buildOrganization } from '@template/db/test';

it('uses serialize helper for ui assertions', async () => {
  const { entity } = await buildOrganization();
  const serialized = entity.__serialize();
  expect(serialized).toBeDefined();
});
