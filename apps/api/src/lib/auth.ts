import { db } from '@template/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { bearer } from 'better-auth/plugins';
import { uuidv7 } from 'uuidv7';
import { env } from '#/config/env';
import { getAllowedOrigins } from '#/middleware/cors';

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_URL,
  basePath: '/auth',

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  socialProviders: {
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }
        : undefined,
  },

  session: {
    expiresIn: 7 * 24 * 60 * 60,
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
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
