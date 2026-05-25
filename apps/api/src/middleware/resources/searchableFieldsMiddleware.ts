import type { LensNarrowing } from '@inixiative/json-rules';
import { makeMiddleware } from '#/lib/utils/makeMiddleware';

type Args = { narrowing: LensNarrowing };

export const searchableFieldsMiddleware = makeMiddleware<Args>(({ narrowing }) => async (c, next) => {
  c.set('narrowing', narrowing);
  await next();
});
