/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { bindLens, type NarrowingDefaults } from '@inixiative/json-rules';
import { polymorphicBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import {
  type EmailLens,
  type EmailLensInput,
  emailLens,
  narrowEmailLens,
} from '@template/email/rules/emailLens';
import { OWNER_EMAIL_SCOPE } from '@template/email/rules/scopes/ownerEmailScope';
import { PLATFORM_EMAIL_SCOPE } from '@template/email/rules/scopes/platformEmailScope';
import { PLATFORM_OWNER_EMAIL_SCOPE } from '@template/email/rules/scopes/platformOwnerEmailScope';
import { TENANT_EMAIL_SCOPE } from '@template/email/rules/scopes/tenantEmailScope';
import type { RuleLens } from '@template/shared/rules';

export type EmailLensOwner = {
  ownerModel: ProviderModel;
  ownerId: string;
  organizationId?: string | null;
} | null;

type Owner = NonNullable<EmailLensOwner>;

const senderOrganizationId = (sender: Owner): string | null | undefined =>
  sender.ownerModel === 'Organization'
    ? sender.ownerId
    : sender.ownerModel === 'Space'
      ? sender.organizationId
      : null;

export const emailLensBindings = (
  owner: EmailLensOwner,
  sender: EmailLensOwner,
): Record<string, string> => ({
  ...(owner ? polymorphicBindings(owner.ownerModel, owner.ownerId) : {}),
  ...(owner?.organizationId ? { ownerOrganizationId: owner.organizationId } : {}),
  ...(sender && senderOrganizationId(sender)
    ? { senderOrganizationId: senderOrganizationId(sender)! }
    : {}),
  ...(sender?.ownerModel === 'Space' ? { senderSpaceId: sender.ownerId } : {}),
});

export const emailScopeFor = (
  owner: EmailLensOwner,
  sender: EmailLensOwner,
): NarrowingDefaults['models'] =>
  owner
    ? sender
      ? TENANT_EMAIL_SCOPE
      : OWNER_EMAIL_SCOPE
    : sender
      ? PLATFORM_OWNER_EMAIL_SCOPE
      : PLATFORM_EMAIL_SCOPE;

export const scopeEmailLens = (
  input: EmailLensInput,
  owner: EmailLensOwner,
  sender: EmailLensOwner = owner,
): EmailLens => {
  const bindings = emailLensBindings(owner, sender);
  return narrowEmailLens(
    emailLens({ ...input, scope: emailScopeFor(owner, sender) }),
    (_root, slot) => bindLens(slot, bindings) as RuleLens,
  );
};
