/**
 * @atlas
 * @kind handler
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type EntitlementTarget, type HydratedRecord, hydrate } from '@template/db';
import type { Permix } from '@template/permissions';
import { makeError } from '#/lib/errors';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import {
  type ChangeEntitlementsContent,
  type ChangeEntitlementsResolutionInput,
  changeEntitlementsContentSchema,
  changeEntitlementsResolutionInputSchema,
} from '#/modules/inquiry/handlers/changeEntitlements/schema';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import { validateIntegrationRole } from '#/modules/integration/validations/validateIntegrationRole';
import { validateTokenWrite } from '#/modules/token/validations/validateTokenWrite';

type Holder = EntitlementTarget & { validateWriter: (writer: Permix) => Promise<void> };

// why: approving is issuing, so each holder runs the checks its own add and remove routes run
const holderOf = async (inquiry: Inquiry): Promise<Holder> => {
  if (inquiry.targetModel === 'Token' && inquiry.targetTokenId) {
    const token = await db.token.findUnique({ where: { id: inquiry.targetTokenId } });
    if (token)
      return {
        model: 'Token',
        id: token.id,
        validateWriter: async (writer) => {
          await validateTokenWrite(writer, token);
          validateDelegateRole(await hydrate('token', token as HydratedRecord));
        },
      };
  }
  if (inquiry.targetModel === 'Integration' && inquiry.targetIntegrationId) {
    const integration = await db.integration.findUnique({
      where: { id: inquiry.targetIntegrationId },
    });
    if (integration)
      return {
        model: 'Integration',
        id: integration.id,
        validateWriter: async (writer) => {
          await validateIntegrationRole(writer, integration);
        },
      };
  }
  throw makeError({ status: 409, message: 'The record this request is addressed to is gone' });
};

export const changeEntitlementsHandler: InquiryHandler<
  ChangeEntitlementsContent,
  ChangeEntitlementsResolutionInput,
  ChangeEntitlementsResolutionInput
> = {
  contentSchema: changeEntitlementsContentSchema,
  resolutionInputSchema: changeEntitlementsResolutionInputSchema,
  resolutionSchema: changeEntitlementsResolutionInputSchema,
  defaultExpirationDays: 30,
  autoApprove: async () => false,

  handleApprove: async (c, inquiry, _content, response) => {
    const writer = c.get('permix');
    const { validateWriter, ...holder } = await holderOf(inquiry);
    await validateWriter(writer);
    await changeEntitlements(writer, holder, { add: response.add, remove: response.remove });
  },
};
