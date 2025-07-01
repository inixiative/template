import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';
import { paginationQuery, paginationResponse } from 'src/app/core/requestSchemas/pagination';

export const resources = (model: string, schema: TSchema, options: Partial<RequestOptions> = {}) => {
  const { tags, params, query, summary, description, authentication, pagination } = { ...requestOptions(), ...options };
  
  return {
    detail: {
      tags,
      summary: summary || `List ${model}s`,
      description: description || `Retrieves a list of ${model} resources`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params,
    query: query || (pagination ? paginationQuery : undefined),
    response: {
      200: t.Object({
        data: t.Array(schema),
        ...(pagination ? { pagination: paginationResponse } : {})
      }),
      ...errorResponses
    }
  };
};