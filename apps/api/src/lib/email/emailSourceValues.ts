/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { type SourceValues, toSourceQueries } from '@inixiative/json-rules';
import { sourceQueryValues } from '@template/db';
import type { ScopeRoot } from '@template/email/render/conditionParser';
import { type EmailLens, emailSlotLenses } from '@template/email/rules';

export const emailSourceValues = (lens: EmailLens): Promise<[ScopeRoot, SourceValues][]> =>
  Promise.all(
    emailSlotLenses(lens).flatMap(([root, slot]) =>
      toSourceQueries(slot).map(
        async (query): Promise<[ScopeRoot, SourceValues]> => [
          root,
          await sourceQueryValues(query, { lens: slot }),
        ],
      ),
    ),
  );
