/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
export const PHONE_SUBTYPES = ['mobile', 'work', 'home', 'personal'] as const;
export type PhoneSubtype = (typeof PHONE_SUBTYPES)[number];
