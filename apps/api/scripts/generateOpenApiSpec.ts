#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { app } from '#/app';

const spec = app.getOpenAPIDocument({
  openapi: '3.1.0',
  info: {
    title: 'Template API',
    version: '1.0.0',
  },
});

const outputPath = resolve(process.cwd(), process.env.OPENAPI_OUTPUT_PATH || './openapi.local.json');
writeFileSync(outputPath, JSON.stringify(spec, null, 2));
console.log(`OpenAPI spec written to ${outputPath}`);
process.exit(0);
