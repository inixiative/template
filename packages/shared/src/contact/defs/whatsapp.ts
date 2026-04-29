import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

export type WhatsappValue = { jid: string; displayName?: string };

const whatsappSchema = z.object({
  jid: z.string().min(1),
  displayName: z.string().optional(),
});

export const whatsappDef: ContactTypeDef<WhatsappValue, WhatsappValue> = {
  inputSchema: whatsappSchema,
  parseInput: (v) => v,
  valueSchema: whatsappSchema,
  toValueKey: (v) => v.jid,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'WhatsApp' },
};
