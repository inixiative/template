import { Elysia } from 'elysia';
import { auth as betterAuthInstance } from '../../../../../auth';

export const auth = new Elysia({ name: 'auth' })
  .onBeforeHandle(({ request }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      console.log(`[AUTH] ${request.method} ${url.pathname}`);
    }
  })
  .onAfterHandle(({ request, response }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      console.log(`[AUTH] Response: ${request.method} ${url.pathname} - Status: ${response.status || 200}`);
    }
  })
  .onError(({ request, error }) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth')) {
      console.error(`[AUTH] Error: ${request.method} ${url.pathname}`, error);
    }
  })
  .mount(() => betterAuthInstance.handler);