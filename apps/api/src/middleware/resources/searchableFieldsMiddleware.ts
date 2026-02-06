import { makeMiddleware } from '#/lib/utils/makeMiddleware';

export const searchableFieldsMiddleware = makeMiddleware<string[] | null>((fields) => async (c, next) => {
  c.set('searchableFields', fields);
  await next();
});
