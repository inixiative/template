/**
 * @atlas
 * @kind client
 * @partOf feature:auth
 * @uses infrastructure:prisma, infrastructure:redis, primitive:appEvents
 */
import { db, redisClient, redisNamespace } from '@template/db';
import { passwordLength } from '@template/shared/auth/passwordLength';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { emitAppEvent } from '#/appEvents/emit';
import { authPlugins } from '#/lib/auth/authPlugins';
import { incrementSecondaryStorageKey } from '#/lib/auth/queries/incrementSecondaryStorageKey';
import { allowedCorsOrigins } from '#/middleware/corsMiddleware';
import { rotateUserJwts } from '#/modules/user/services/rotateUserJwts';

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: 'postgresql',
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: passwordLength.min,
    maxPasswordLength: passwordLength.max,
    onPasswordReset: async ({ user }) => rotateUserJwts(user.id),
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }: { user: { id: string }; url: string }) => {
      await emitAppEvent('user.verificationRequested', { userId: user.id, verificationUrl: url });
    },
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

  // Sessions exist only for the sign-in handshake; jwtHandoffPlugin swaps each one for a JWT.
  session: {
    expiresIn: 10 * 60,
  },

  user: {
    additionalFields: {
      platformRole: {
        type: ['user', 'superadmin'],
        required: false,
        defaultValue: 'user',
        input: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
        input: false,
      },
      jwtVersion: {
        type: 'number',
        required: false,
        defaultValue: 0,
        input: false,
        returned: false,
      },
      twoFactorEnabled: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  advanced: {
    database: {
      generateId: () => Bun.randomUUIDv7(),
      // why: Prisma field encryption replaces jwks.privateKey with encryptedPrivateKey* columns
      validateSchema: false,
    },
  },

  plugins: authPlugins(),

  // Every endpoint that acts on a live session: none survives sign-in, and a session never mints a JWT.
  disabledPaths: [
    '/token',
    '/get-session',
    '/update-session',
    '/list-sessions',
    '/revoke-session',
    '/revoke-sessions',
    '/revoke-other-sessions',
    '/sign-out',
    '/update-user',
    '/change-email',
    '/change-password',
    '/verify-password',
    '/delete-user',
    '/delete-user/callback',
    '/link-social',
    '/unlink-account',
    '/list-accounts',
    '/account-info',
    '/get-access-token',
    '/refresh-token',
    '/one-time-token/generate',
  ],

  trustedOrigins: allowedCorsOrigins(),

  // Failures before the flow's own errorCallbackURL is known (e.g. state_mismatch) land on web login, not the API.
  onAPIError: process.env.WEB_URL ? { errorURL: `${process.env.WEB_URL}/login` } : undefined,

  secondaryStorage: {
    get: async (key) => {
      const value = await redisClient().get(`${redisNamespace.session}:${key}`);
      return value ? JSON.parse(value) : null;
    },
    set: async (key, value, ttl) => {
      await redisClient().setex(
        `${redisNamespace.session}:${key}`,
        ttl ?? 86400,
        JSON.stringify(value),
      );
    },
    delete: async (key) => {
      await redisClient().del(`${redisNamespace.session}:${key}`);
    },
    getAndDelete: async (key) => {
      const value = await redisClient().getdel(`${redisNamespace.session}:${key}`);
      return value ? JSON.parse(value) : null;
    },
    increment: (key, ttl) => incrementSecondaryStorageKey(key, ttl),
  },
});

export type Auth = typeof auth;
