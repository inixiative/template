import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';

interface ResourceOptions extends Partial<RequestOptions> {
  noId?: boolean;
}

export const resource = (model: string, schema: TSchema, options: ResourceOptions = {}): any => {
  const { tags, params, query, summary, description, authentication, requireAuth, noId } = { ...requestOptions(), ...options };
  
  return {
    detail: {
      tags,
      summary: summary || `Get ${model}`,
      description: description || `Retrieves a ${model} resource`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params: params || (noId ? undefined : t.Object({ id: t.String() })),
    query,
    response: {
      200: t.Object({
        data: schema
      }),
      ...errorResponses
    },
    requireAuth
  };
};