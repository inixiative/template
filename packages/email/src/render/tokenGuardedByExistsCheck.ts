/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { ELSE, END, IF } from '@template/email/render/conditionParser/grammar';

export const tokenGuardedByExistsCheck = (path: string, fallback = ''): string =>
  `${IF}${JSON.stringify({ field: path, operator: 'exists' })}}}{{${path}}}${ELSE}${fallback}${END}`;
