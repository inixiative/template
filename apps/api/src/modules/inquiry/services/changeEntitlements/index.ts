/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma
 */
import { db, type EntitlementTarget, rowPolymorphicAxisPointsAt } from '@template/db';
import { toEntitlementEntry } from '@template/permissions';
import { entitlementProblem } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateEntitlementWriter } from '#/lib/permissions/validateEntitlementWriter';
import {
  fetchIntegrationNamedByKey,
  resolveRequestedEntitlements,
} from '#/modules/inquiry/services/changeEntitlements/resolveRequestedEntitlements';
import {
  type ChangeEntitlementsContent,
  type ChangeEntitlementsResolutionInput,
  changeEntitlementsContentSchema,
  changeEntitlementsResolutionInputSchema,
  type RequestedEntitlement,
} from '#/modules/inquiry/services/changeEntitlements/schema';
import type { Inquiry, InquiryService } from '#/modules/inquiry/services/types';

const keyedEntitlementForCheck = async ({
  source,
  ...rest
}: Extract<RequestedEntitlement, { source: unknown }>) => {
  await fetchIntegrationNamedByKey(source);
  return { ...rest, sourceId: source.externalId };
};

export const holderModels: readonly EntitlementTarget['model'][] = ['Token', 'Integration'];

// why: the same check the writer runs, so a request the writer would refuse is refused when asked
const validate = async (_inquiry: Partial<Inquiry>, content: ChangeEntitlementsContent) => {
  for (const [index, requested] of content.add.entries()) {
    const input = 'source' in requested ? await keyedEntitlementForCheck(requested) : requested;
    const found = entitlementProblem(toEntitlementEntry(input));
    if (found) throw makeError({ status: 422, message: `add.${index}: ${found}` });
  }
};

const holderOf = async (inquiry: Inquiry) => {
  const target = rowPolymorphicAxisPointsAt(inquiry, 'Inquiry', 'targetModel');
  const model = holderModels.find((holderModel) => holderModel === target?.model);
  const holder =
    target && model ? await db.delegate(model).findUnique({ where: { id: target.id } }) : null;
  if (!model || !holder)
    throw makeError({ status: 409, message: 'The record this request is addressed to is gone' });
  return { model, holder: holder as Record<string, unknown> & { id: string } };
};

export const changeEntitlementsService: InquiryService<
  ChangeEntitlementsContent,
  ChangeEntitlementsResolutionInput,
  ChangeEntitlementsResolutionInput
> = {
  contentSchema: changeEntitlementsContentSchema,
  resolutionInputSchema: changeEntitlementsResolutionInputSchema,
  resolutionSchema: changeEntitlementsResolutionInputSchema,
  defaultExpirationDays: 30,
  unique: 'targeted',
  validate,
  autoApprove: async () => false,

  handleApprove: async (c, inquiry, _content, response) => {
    if (!response.add.length && !response.remove.length)
      throw makeError({
        status: 422,
        message: 'An approval sends back what it approves; to give nothing, deny',
      });
    const writer = c.get('permix');
    const { model, holder } = await holderOf(inquiry);
    const changes = {
      add: await resolveRequestedEntitlements(writer, response.add),
      remove: response.remove,
    };
    // why: approving is issuing, so it runs the check the holder's own add and remove routes run
    await validateEntitlementWriter(writer, model, holder, changes);
    await changeEntitlements(writer, { model, id: holder.id }, changes);
  },
};
