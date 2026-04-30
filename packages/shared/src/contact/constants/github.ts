export const GITHUB_CLASSIFIERS = ['user', 'org'] as const;
export type GithubClassifier = (typeof GITHUB_CLASSIFIERS)[number];
