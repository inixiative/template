/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { entitlementProblem } from '@inixiative/permissions';
import type { EntitlementEntry } from '@template/permissions/client';
import { isPlainObject } from 'lodash-es';

export const wellFormedEntitlements = (value: unknown): EntitlementEntry[] =>
  Array.isArray(value)
    ? value.filter(
        (entry): entry is EntitlementEntry =>
          isPlainObject(entry) && entitlementProblem(entry as EntitlementEntry) === null,
      )
    : [];
