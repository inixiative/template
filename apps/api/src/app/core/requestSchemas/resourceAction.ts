import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';

interface ResourceActionOptions extends Partial<RequestOptions> {
  noId?: boolean;
  body?: TSchema;
}

export const resourceAction = (model: string, schema: TSchema, options: ResourceActionOptions = {}): any => {
  const { tags, params, query, summary, description, authentication, requireAuth, noId, body } = { ...requestOptions(), ...options };
  
  const obj: any = {
    detail: {
      tags,
      summary: summary || `Perform action on ${model}`,
      description: description || `Performs an action on a ${model} resource`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params: params || (noId ? undefined : t.Object({ id: t.String() })),
    query,
    response: {
      200: t.Object({
        data: schema
      }),
      201: t.Object({
        data: schema
      }),
      ...errorResponses
    },
    requireAuth
  };
  
  if (body) obj.body = body;
  
  return obj;
};