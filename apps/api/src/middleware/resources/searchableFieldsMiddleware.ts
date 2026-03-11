import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type SearchableFieldsOptions = {
  searchableFields: readonly string[] | null;
  adminSearchableFields?: readonly string[] | null;
};

export const searchableFieldsMiddleware = makeMiddleware<SearchableFieldsOptions>((options) => async (c, next) => {
  c.set('searchableFields', options.searchableFields);
  if (options.adminSearchableFields?.length) c.set('adminSearchableFields', options.adminSearchableFields);
  await next();
});
