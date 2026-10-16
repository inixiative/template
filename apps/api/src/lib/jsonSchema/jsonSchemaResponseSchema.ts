/**
 * @atlas
 * @kind schema
 * @partOf primitive:routeTemplates
 * @uses none
 */
import { z } from '@hono/zod-openapi';

export const jsonSchemaResponseSchema = z
  .record(z.string(), z.unknown())
  .openapi({ description: 'JSON Schema (draft 2020-12).' });
