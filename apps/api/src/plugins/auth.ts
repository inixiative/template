import { Elysia } from 'elysia';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

export const auth = new Elysia({ name: 'auth' })
  .guard({
    beforeHandle({ db }) {
      if (!db) throw new Error('Database plugin is required for auth');
    }
  })
  .derive(({ db }) => {
    const betterAuthInstance = betterAuth({
      database: prismaAdapter(db, {
        provider: 'postgresql'
      }),
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false
      },
      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        }
      },
      trustedOrigins: [
        process.env.WEB_URL,
        process.env.ADMIN_URL
      ]
    });
    
    return { auth: betterAuthInstance };
  })
  .all('/api/auth/*', async ({ auth, request }) => {
    return auth.handler(request);
  });
