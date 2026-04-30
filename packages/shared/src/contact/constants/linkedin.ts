export const LINKEDIN_CLASSIFIERS = ['personal', 'company', 'school'] as const;
export type LinkedinClassifier = (typeof LINKEDIN_CLASSIFIERS)[number];
