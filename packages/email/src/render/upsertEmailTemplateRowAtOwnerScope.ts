/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailTemplate } from '@template/db/generated/client/client';
import { saveScopedRow } from '@template/email/render/saveScopedRow';
import type { OwnerScope } from '@template/email/render/types';

export const upsertEmailTemplateRowAtOwnerScope = (
  input: EmailTemplate,
  ctx: OwnerScope,
): Promise<EmailTemplate> => saveScopedRow('emailTemplate', input, ctx);
