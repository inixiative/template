import { EMAIL_SUBTYPES } from '@template/shared/contact/constants/email';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

export type EmailValue = { address: string };

const emailSchema = z.object({ address: z.string().email() });

export const emailDef: ContactTypeDef<EmailValue, EmailValue> = {
  inputSchema: emailSchema,
  parseInput: (v) => ({ address: v.address.toLowerCase() }),
  valueSchema: emailSchema,
  toValueKey: (v) => v.address,
  subtype: { mode: 'optional', values: EMAIL_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Email', icon: 'Mail' },
};
