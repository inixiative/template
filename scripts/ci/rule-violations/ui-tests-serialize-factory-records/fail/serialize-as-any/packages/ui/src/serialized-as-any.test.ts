import { buildOrganization } from '@template/db/test';

it('uses forbidden serialize cast', async () => {
  const { entity } = await buildOrganization();
  const serialized = entity.__serialize() as any;
  expect(serialized).toBeDefined();
});
