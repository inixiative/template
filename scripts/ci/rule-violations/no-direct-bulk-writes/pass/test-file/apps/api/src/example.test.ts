import { db } from '@template/db';

it('rejects a direct bulk write', async () => {
  // Tests may call the raw op to assert the guard throws.
  await expect(db.contact.createMany({ data: [] })).rejects.toThrow();
});
