import { WEBSITE_SUBTYPES } from '@template/shared/contact/constants/website';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { canonicalUrl } from '@template/shared/contact/parsers';
import { z } from 'zod';

export type WebsiteValue = { url: string };

const websiteSchema = z.object({ url: z.string().url() });

export const websiteDef: ContactTypeDef<WebsiteValue, WebsiteValue> = {
  inputSchema: websiteSchema,
  parseInput: (v) => v,
  valueSchema: websiteSchema,
  toValueKey: (v) => canonicalUrl(v.url),
  subtype: { mode: 'optional', values: WEBSITE_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Website' },
};
