import type { GithubClassifier } from '@template/shared/contact/constants/github';
import { parseSimpleHandleUrl } from '@template/shared/contact/parsers/url';

export type GithubValue = { classifier: GithubClassifier; handle: string };

// GitHub URLs and bare handles share a slug namespace, but URLs alone don't
// reveal whether a slug is a user or an org. Caller passes the classifier
// when known (typical for OAuth flows); URL-only input defaults to 'user'.
export const parseGithubUrl = (url: string, hint?: GithubClassifier): GithubValue => ({
  classifier: hint ?? 'user',
  handle: parseSimpleHandleUrl('github.com', url),
});
