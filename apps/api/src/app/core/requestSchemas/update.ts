import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';
import { sanitizeBody } from 'src/app/core/requestSchemas/sanitizeBody';

interface UpdateOptions extends Partial<RequestOptions> {
  noId?: boolean;
}

export const update = (model: string, schema: TSchema, options: UpdateOptions = {}) => {
  const { tags, params, query, summary, description, authentication, sanitizeKeys, noId } = { ...requestOptions(), ...options };
  
  return {
    detail: {
      tags,
      summary: summary || `Update ${model}`,
      description: description || `Updates an existing ${model} resource`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params: params || (noId ? undefined : t.Object({ id: t.String() })),
    query,
    body: sanitizeBody(schema, sanitizeKeys),
    response: {
      200: t.Object({
        data: schema
      }),
      ...errorResponses
    }
  };
};