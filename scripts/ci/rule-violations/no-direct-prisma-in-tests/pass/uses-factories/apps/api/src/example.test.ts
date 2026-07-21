import { createOrganization, createUser } from '@template/db/test';

describe('example', () => {
  test('uses factories correctly', async () => {
    const { entity: org } = await createOrganization({ name: 'Test' });
    const { entity: user } = await createUser();
    expect(org).toBeTruthy();
    expect(user).toBeTruthy();
  });
});
