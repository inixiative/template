/**
 * @atlas
 * @kind constant, definition
 * @partOf primitive:shared
 * @uses none
 */
import { EMAIL_SUBTYPES } from '@template/shared/contact/constants/email';
import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

export type EmailValue = { address: string };

export const emailAddressSchema = z.string().email();

const emailSchema = z.object({ address: emailAddressSchema });

export const emailDef: ContactTypeDef<EmailValue, EmailValue> = {
  inputSchema: emailSchema,
  parseInput: (v) => ({ address: v.address.toLowerCase() }),
  valueSchema: emailSchema,
  toValueKey: (v) => v.address,
  redact: (id) => ({ address: `redacted-${id}@deleted.null` }),
  subtype: { mode: 'optional', values: EMAIL_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Email', icon: 'lucide:mail' },
};
