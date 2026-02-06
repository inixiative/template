import 'src/config/loadEnv';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
    schemas: {
      user: {
        tableName: 'users'
      },
      session: {
        tableName: 'sessions'
      },
      account: {
        tableName: 'accounts'
      },
      verification: {
        tableName: 'verifications'
      }
    }
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.API_URL || `http://localhost:${process.env.PORT || 8000}`,
  basePath: '/api/auth',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    }
  },
  trustedOrigins: [
    process.env.WEB_URL,
    process.env.ADMIN_URL,
    process.env.SUPERADMIN_URL,
  ].filter(Boolean)
});
