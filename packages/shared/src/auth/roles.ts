/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
// Mirrors Prisma's Role enum; packages/db/src/sharedEnumMirrors.test.ts fails on drift.
export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const;

export type SharedRole = (typeof ROLES)[number];
