/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:authz
 * @uses none
 */
import type { Context } from 'hono';
import { findUnheldGrant } from '#/lib/permissions/findUnheldGrant';
import type { Inquiry, InquiryHandler } from '#/modules/inquiry/handlers/types';
import type { AppEnv } from '#/types/appEnv';

export const senderHoldsGrant = async (
  c: Context<AppEnv>,
  handler: InquiryHandler,
  inquiry: Inquiry,
): Promise<boolean> => {
  if (!handler.grantOf) return true;
  const grant = handler.grantOf(handler.contentSchema.parse(inquiry.content));
  return !(await findUnheldGrant(c, grant)).length;
};
