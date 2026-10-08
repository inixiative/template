/**
 * @atlas
 * @kind service
 * @partOf feature:email, infrastructure:seed
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent } from '@template/db/generated/client/client';
import type { SeedSavers } from '@template/db/prisma/seed';
import { ownerScopeOf, type SaveTemplateInput, saveEmailComponents } from '@template/email/render';
import { emailLensFor } from '#/lib/email/emailLensFor';
import { saveEmailTemplate } from '#/lib/email/saveEmailTemplate';

/** Seeded email rows persist through the save the app uses, so a seed that would not validate fails the run. */
export const emailSeedSavers: SeedSavers = {
  emailComponent: (record) => {
    const owner = ownerScopeOf(record as unknown as SaveTemplateInput);
    return db.txn(() =>
      saveEmailComponents(
        [record as unknown as EmailComponent],
        owner,
        emailLensFor(undefined, owner),
      ),
    );
  },
  emailTemplate: (record) => saveEmailTemplate(record as unknown as SaveTemplateInput),
};
