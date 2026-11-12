import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

export const auth = betterAuth({ plugins: [bearer()] });
