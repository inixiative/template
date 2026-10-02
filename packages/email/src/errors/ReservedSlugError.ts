/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
import type { EmailOwnerModel } from '@template/db/generated/client/client';

export class ReservedSlugError extends Error {
  constructor(
    readonly slug: string,
    readonly ownerModel: EmailOwnerModel,
    readonly heldBy: EmailOwnerModel,
  ) {
    super(
      heldBy === 'admin'
        ? `Template slug "${slug}" is an admin template and cannot be overridden by a ${ownerModel} template.`
        : `Template slug "${slug}" is already used by a ${heldBy} template, so it cannot become an admin template.`,
    );
    this.name = 'ReservedSlugError';
  }
}
