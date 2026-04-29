export const PHONE_SUBTYPES = ['mobile', 'work', 'home', 'personal'] as const;
export type PhoneSubtype = (typeof PHONE_SUBTYPES)[number];
