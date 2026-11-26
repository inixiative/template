/**
 * @atlas
 * @kind service
 * @partOf primitive:ui
 * @uses none
 */

import { createAuthClient } from 'better-auth/client';
import { oneTimeTokenClient } from 'better-auth/client/plugins';

export const betterAuthClient = () => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return createAuthClient({ baseURL, plugins: [oneTimeTokenClient()] });
};
