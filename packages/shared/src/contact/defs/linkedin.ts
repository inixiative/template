import { LINKEDIN_CLASSIFIERS } from '@template/shared/contact/constants/linkedin';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { type LinkedinValue, parseLinkedinUrl } from '@template/shared/contact/parsers';
import { z } from 'zod';

const linkedinStored = z.object({
  classifier: z.enum(LINKEDIN_CLASSIFIERS),
  handle: z.string().min(1),
});

type LinkedinInput = LinkedinValue | { url: string };
const linkedinInput: z.ZodType<LinkedinInput> = z.union([
  z.object({ url: z.string().url() }),
  linkedinStored,
]);

export const linkedinDef: ContactTypeDef<LinkedinInput, LinkedinValue> = {
  inputSchema: linkedinInput,
  parseInput: (input) => ('url' in input ? parseLinkedinUrl(input.url) : input),
  valueSchema: linkedinStored,
  toValueKey: (v) => `${v.classifier}:${v.handle.toLowerCase()}`,
  toUrl: (v) =>
    `https://linkedin.com/${v.classifier === 'personal' ? 'in' : v.classifier}/${v.handle}`,
  subtype: { mode: 'forbidden' }, // classifier lives in `value`
  uniqueness: 'per-owner',
  display: { label: 'LinkedIn', icon: 'Linkedin' },
};
