/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
export const RAIL_PROVIDED_SYSTEM_FIELDS = ['unsubscribeUrl'] as const;

export type RailProvidedSystemField = (typeof RAIL_PROVIDED_SYSTEM_FIELDS)[number];

const RAIL_PROVIDED = new Set<string>(RAIL_PROVIDED_SYSTEM_FIELDS);

export const isRailProvidedSystemField = (field: string): field is RailProvidedSystemField => RAIL_PROVIDED.has(field);
