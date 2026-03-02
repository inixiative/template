import { createAuthClient } from '@template/shared';

export const authClient = createAuthClient(import.meta.env.VITE_API_URL);

export type AuthClient = typeof authClient;
