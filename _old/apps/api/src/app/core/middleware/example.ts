import { Elysia } from 'elysia';

export const exampleMiddleware = new Elysia({ name: 'exampleMiddleware' })
  .onBeforeHandle(({ request }) => {
    console.log(`${request.method} ${request.url}`);
  })
  .onError(({ error, code }) => {
    console.error(`Error ${code}:`, error);
  });