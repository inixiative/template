/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { fetchComponentsThroughOwnerCascade } from '@template/email/render/fetchComponentsThroughOwnerCascade';
import { fetchMissingComponentSlugs } from '@template/email/render/fetchMissingComponentSlugs';
import { ownerScopeOfRow } from '@template/email/render/owner';
import type { EmailModel } from '@template/email/render/types';
import { isEqual } from 'lodash-es';

export const recomputeAndStoreMissingComponentSlugs = (
  model: EmailModel,
  id: string,
): Promise<boolean> =>
  db.txn(async () => {
    const fetchRowAndMissingComponentSlugs = async () => {
      const where = { id, deletedAt: null };
      const row =
        model === 'EmailTemplate'
          ? await db.emailTemplate.findFirst({ where })
          : await db.emailComponent.findFirst({ where });
      if (!row) return { row, computed: [], unchanged: true };
      const computed = await fetchMissingComponentSlugs(row.mjml, (slugs) =>
        fetchComponentsThroughOwnerCascade(slugs, ownerScopeOfRow(row)),
      );
      return { row, computed, unchanged: isEqual([...row.missingComponentSlugs].sort(), computed) };
    };
    const beforeLock = await fetchRowAndMissingComponentSlugs();
    if (beforeLock.unchanged) return false;
    await db.findForUpdate(model, { id });
    const { row, computed, unchanged } = await fetchRowAndMissingComponentSlugs();
    if (!row || unchanged) return false;
    const args = {
      where: { id, updatedAt: row.updatedAt },
      data: { missingComponentSlugs: computed, updatedAt: row.updatedAt },
    };
    const written =
      model === 'EmailTemplate'
        ? await db.emailTemplate.updateManyAndReturn(args)
        : await db.emailComponent.updateManyAndReturn(args);
    return written.length > 0;
  });
