/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { fetchMissingComponentSlugs } from '@template/email/render/fetchMissingComponentSlugs';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { ownerScopeOfRow } from '@template/email/render/owner';
import type { EmailModel } from '@template/email/render/types';
import { isEqual } from 'lodash-es';

export const recomputeAndStoreMissingComponentSlugs = (
  model: EmailModel,
  id: string,
): Promise<boolean> =>
  db.txn(async () => {
    const readDegradation = async () => {
      const where = { id, deletedAt: null };
      const row =
        model === 'EmailTemplate'
          ? await db.emailTemplate.findFirst({ where })
          : await db.emailComponent.findFirst({ where });
      if (!row) return { row, computed: [], unchanged: true };
      const computed = await fetchMissingComponentSlugs(row.mjml, (slugs) =>
        lookupCascade(slugs, ownerScopeOfRow(row)),
      );
      return { row, computed, unchanged: isEqual([...row.missingComponentSlugs].sort(), computed) };
    };
    const beforeLock = await readDegradation();
    if (beforeLock.unchanged) return false;
    await db.findForUpdate(model, { id });
    const { row, computed, unchanged } = await readDegradation();
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
