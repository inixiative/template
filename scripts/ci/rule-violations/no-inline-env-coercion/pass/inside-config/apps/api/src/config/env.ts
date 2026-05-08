// The canonical env file is allowed to contain coercion.
import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(8000),
  RETENTION_DAYS: z.coerce.number().int().positive().default(90),
});

if (process.env.NODE_ENV !== 'test') {
  process.env = schema.parse(process.env) as unknown as NodeJS.ProcessEnv;
}

// Even Number.parseInt(process.env.X) here would be allowed, but we shouldn't need it.
const _example = Number.parseInt(process.env.SOMETHING ?? '0', 10);
void _example;
