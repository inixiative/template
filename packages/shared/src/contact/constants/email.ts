/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
export const EMAIL_SUBTYPES = ['personal', 'work'] as const;
export type EmailSubtype = (typeof EMAIL_SUBTYPES)[number];
