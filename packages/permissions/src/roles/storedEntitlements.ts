/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { entitlementProblem } from '@inixiative/permissions';
import type { Role } from '@template/db/generated/client/enums';
import type { EntitlementEntry } from '@template/permissions/client';

const wellFormed = (entry: unknown): entry is EntitlementEntry =>
  typeof entry === 'object' &&
  entry !== null &&
  entitlementProblem(entry as EntitlementEntry) === null;

export const storedEntitlements = (stored: unknown): EntitlementEntry[] =>
  Array.isArray(stored) ? stored.filter(wellFormed) : [];

export const standsOnMalformedEntitlements = (
  delegate: { role?: Role | null; full?: boolean; entitlements?: unknown } | null | undefined,
): boolean =>
  !!delegate &&
  !delegate.role &&
  !delegate.full &&
  Array.isArray(delegate.entitlements) &&
  !delegate.entitlements.every(wellFormed);
