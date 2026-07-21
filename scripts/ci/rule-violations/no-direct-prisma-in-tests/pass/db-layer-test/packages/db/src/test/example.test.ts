// db-layer tests under packages/db/src/test/** exercise the raw client seam itself — exempt.
// Import-free on purpose: `bun test packages/db/` path-filters by substring and executes
// this fixture, so it must run harmlessly.
it('db-layer fixture: direct db.<model>.create is exempt under packages/db/src/test', () => {
  const db = { user: { create: (_args: unknown) => Promise.resolve({}) } };
  void db.user.create({ data: { email: 'x@example.com' } });
  expect(true).toBe(true);
});
