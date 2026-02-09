import { db, getRedisClient, redisNamespace } from '@template/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { uuidv7 } from 'uuidv7';
import { getAllowedOrigins } from '#/middleware/corsMiddleware';

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL,
  basePath: '/auth',

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google:
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,
    // Stateless JWT sessions - no DB session lookups
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
      strategy: 'jwe', // Encrypted JWT - use 'jwt' if you need external verification
    },
  },

  user: {
    additionalFields: {
      platformRole: {
        type: ['user', 'superadmin'],
        required: false,
        defaultValue: 'user',
        input: false,
      },
    },
  },

  advanced: {
    database: {
      generateId: uuidv7,
    },
  },

  plugins: [bearer()],

  trustedOrigins: getAllowedOrigins(),

  secondaryStorage: {
    get: async (key) => {
      const value = await getRedisClient().get(`${redisNamespace.session}:${key}`);
      return value ? JSON.parse(value) : null;
    },
    set: async (key, value, ttl) => {
      await getRedisClient().setex(`${redisNamespace.session}:${key}`, ttl ?? 86400, JSON.stringify(value));
    },
    delete: async (key) => {
      await getRedisClient().del(`${redisNamespace.session}:${key}`);
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
