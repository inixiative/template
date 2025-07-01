import { t, TSchema } from 'elysia';
import { errorResponses } from 'src/app/core/requestSchemas/errorResponses';
import { requestOptions, RequestOptions } from 'src/app/core/requestSchemas/requestOptions';

interface DeleteOptions extends Partial<RequestOptions> {
  noId?: boolean;
}

export const deleteResource = (model: string, options: DeleteOptions = {}) => {
  const { tags, params, query, summary, description, authentication, noId } = { ...requestOptions(), ...options };
  
  return {
    detail: {
      tags,
      summary: summary || `Delete ${model}`,
      description: description || `Deletes a ${model} resource`,
      security: authentication ? [{ cookieAuth: [] }] : undefined
    },
    params: params || (noId ? undefined : t.Object({ id: t.String() })),
    query,
    response: {
      204: t.Void(),
      ...errorResponses
    }
  };
};