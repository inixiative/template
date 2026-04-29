import { GITHUB_CLASSIFIERS } from '@template/shared/contact/constants/github';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type GithubValue, parseGithubUrl } from '@template/shared/contact/parsers';
import { z } from 'zod';

const githubStored = z.object({
  classifier: z.enum(GITHUB_CLASSIFIERS),
  handle: z.string().min(1),
});

type GithubInput = GithubValue | { url: string; classifier?: GithubValue['classifier'] };
const githubInput: z.ZodType<GithubInput> = z.union([
  z.object({ url: z.string().url(), classifier: z.enum(GITHUB_CLASSIFIERS).optional() }),
  githubStored,
]);

export const githubDef: ContactTypeDef<GithubInput, GithubValue> = {
  inputSchema: githubInput,
  parseInput: (input) => ('url' in input ? parseGithubUrl(input.url, input.classifier) : input),
  valueSchema: githubStored,
  toValueKey: (v) => `${v.classifier}:${v.handle.toLowerCase()}`,
  toUrl: (v) => `https://github.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'GitHub', icon: 'Github' },
};
