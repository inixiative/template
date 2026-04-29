import type { ContactTypeDef } from '@template/shared/contact/defs/base';
import { z } from 'zod';

export type DiscordValue = { userId: string; tag?: string };

const discordSchema = z.object({
  userId: z.string().min(1),
  tag: z.string().optional(),
});

export const discordDef: ContactTypeDef<DiscordValue, DiscordValue> = {
  inputSchema: discordSchema,
  parseInput: (v) => v,
  valueSchema: discordSchema,
  toValueKey: (v) => v.userId,
  subtype: { mode: 'forbidden' },
  uniqueness: 'per-owner',
  display: { label: 'Discord', icon: 'MessageSquare' },
};
