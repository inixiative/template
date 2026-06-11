/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 */
export const GITHUB_CLASSIFIERS = ['user', 'org'] as const;
export type GithubClassifier = (typeof GITHUB_CLASSIFIERS)[number];
