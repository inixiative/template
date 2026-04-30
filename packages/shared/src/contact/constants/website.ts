export const WEBSITE_SUBTYPES = ['main', 'portfolio', 'blog'] as const;
export type WebsiteSubtype = (typeof WEBSITE_SUBTYPES)[number];
