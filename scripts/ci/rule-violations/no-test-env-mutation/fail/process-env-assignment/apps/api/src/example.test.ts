describe('leaks process.env', () => {
  it('mutates process.env', () => {
    process.env.WEBHOOK_SIGNING_PRIVATE_KEY = '';
    expect(true).toBe(true);
  });
});
