import { PHONE_SUBTYPES } from '@template/shared/contact/constants/phone';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { CountryCodeSchema } from '@template/shared/reference/countries';
import { z } from 'zod';

export type PhoneValue = { e164: string; country: z.infer<typeof CountryCodeSchema> };

const phoneSchema = z.object({
  e164: z.string().regex(/^\+\d{7,15}$/, 'phone must be E.164 (+ followed by 7–15 digits)'),
  country: CountryCodeSchema,
});

export const phoneDef: ContactTypeDef<PhoneValue, PhoneValue> = {
  inputSchema: phoneSchema,
  parseInput: (v) => v,
  valueSchema: phoneSchema,
  toValueKey: (v) => v.e164,
  subtype: { mode: 'optional', values: PHONE_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Phone', icon: 'Phone' },
};
