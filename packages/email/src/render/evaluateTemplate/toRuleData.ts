/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Scope } from '@template/email/render/evaluateTemplate/types';
import { isUndefined, omitBy } from 'lodash-es';

export const toRuleData = (scope: Scope): Record<string, unknown> => omitBy(scope, isUndefined);
