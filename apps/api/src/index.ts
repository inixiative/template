import { app } from './app';
import { env } from './config/env';

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

console.log(`🚀 Inixiative API running at http://localhost:${server.port}`);
console.log(`📚 OpenAPI docs at http://localhost:${server.port}/openapi/docs`);
console.log(`🏥 Health check at http://localhost:${server.port}/health`);
