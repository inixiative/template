export const authConfig = {
  session: {
    expiresIn: 7 * 24 * 60 * 60,
    cookieCache: { enabled: true, maxAge: 7 * 24 * 60 * 60, strategy: 'jwe' },
  },
};
