import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';
import { existsSync } from 'fs';
import { EnvSchema } from 'src/config/envSchema';

const environment = process.env.ENVIRONMENT;
if (environment) {
  const envPath = `./env/.env.${environment}`;
  if (existsSync(envPath)) {
    const config = dotenv.config({path: envPath});
    dotenvExpand.expand(config);
  }
}

const rawEnv = process.env;
const parsedEnv: Record<string, any> = {};

// Convert string values to proper types based on schema
for (const [key, value] of Object.entries(rawEnv)) {
  if (key in EnvSchema.properties) {
    const schema = EnvSchema.properties[key];

    if (schema.type === 'number' || schema.type === 'integer') {
      parsedEnv[key] = value !== undefined && value !== '' ? Number(value) : undefined;
    } else if (schema.type === 'boolean') {
      parsedEnv[key] = value !== 'false' && value !== '';
    } else {
      parsedEnv[key] = value;
    }
  }
}

// Apply defaults from schema
for (const [key, schema] of Object.entries(EnvSchema.properties)) {
  if (parsedEnv[key] === undefined && 'default' in schema) {
    parsedEnv[key] = schema.default;
  }
}

// Override process.env with parsed values
Object.assign(process.env, parsedEnv);
