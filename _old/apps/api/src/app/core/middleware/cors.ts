import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';

export const corsMiddleware = new Elysia({ name: 'cors-middleware' })
  .use(cors({
    origin: (request) => {
      const allowedOrigins = [
        process.env.WEB_URL,
        process.env.ADMIN_URL
      ].filter(Boolean);
      
      const origin = request.headers.get('origin');
      
      if (!origin) return false;
      
      return allowedOrigins.includes(origin) ? origin : false;
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'X-Request-Id']
  }));
