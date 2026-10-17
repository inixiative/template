describe('leaks process.env conditionally', () => {
  it('mutates process.env with ??=', () => {
    process.env.STRIPE_SECRET_KEY ??= 'test-secret';
    expect(true).toBe(true);
  });
});
