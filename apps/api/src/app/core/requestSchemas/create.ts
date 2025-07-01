import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';
import { sanitizeBody } from 'src/app/core/requestSchemas/sanitizeBody';

export const create = (model: string, schema: TSchema, options: Partial<RequestOptions> = {}): any => {
  const { tags, params, query, summary, description, authentication, requireAuth, sanitizeKeys } = { ...requestOptions(), ...options };
  
  return {
    detail: {
      tags,
      summary: summary || `Create a new ${model}`,
      description: description || `Creates a new ${model} resource`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params,
    query,
    body: sanitizeBody(schema, sanitizeKeys),
    response: {
      201: t.Object({
        data: schema
      }),
      ...errorResponses
    },
    requireAuth
  };
};