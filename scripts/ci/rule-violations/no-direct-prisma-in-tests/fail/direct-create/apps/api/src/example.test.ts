describe('bad test', () => {
  test('creates directly with prisma', async () => {
    const org = await db.organization.create({ data: { name: 'Test', slug: 'test' } });
    expect(org).toBeTruthy();
  });
});
