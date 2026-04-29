import type { ContactType } from '@template/db/generated/client/enums';
import { CountryCodeSchema } from '@template/shared/reference/countries';
import {
  canonicalUrl,
  type GithubValue,
  type LinkedinValue,
  parseGithubUrl,
  parseLinkedinUrl,
  parseTelegramUrl,
  parseTwitterUrl,
  type TelegramValue,
  type TwitterValue,
} from '@template/shared/contact/parsers';
import { z } from 'zod';

// ── as-const subtype/classifier sets ────────────────────────────────────────
export const PHONE_SUBTYPES = ['mobile', 'work', 'home', 'personal'] as const;
export const EMAIL_SUBTYPES = ['personal', 'work'] as const;
export const WEBSITE_SUBTYPES = ['main', 'portfolio', 'blog'] as const;
export const LINKEDIN_CLASSIFIERS = ['personal', 'company', 'school'] as const;
export const GITHUB_CLASSIFIERS = ['user', 'org'] as const;

export type PhoneSubtype = (typeof PHONE_SUBTYPES)[number];
export type EmailSubtype = (typeof EMAIL_SUBTYPES)[number];
export type WebsiteSubtype = (typeof WEBSITE_SUBTYPES)[number];

// ── Per-type definition shape ───────────────────────────────────────────────
export type ContactSubtypeRule =
  | { mode: 'forbidden' }
  | { mode: 'optional'; values: readonly string[] }
  | { mode: 'required'; values: readonly string[] };

export type ContactTypeDef<TInput, TStored> = {
  // Loose schema accepting URL paste, structured input, etc.
  inputSchema: z.ZodType<TInput>;
  // Normalize loose input → strict canonical storage shape.
  parseInput: (input: TInput) => TStored;
  // Strict schema for the canonical stored shape (post-parse safety net).
  valueSchema: z.ZodType<TStored>;
  // Canonical projection used for indexing + uniqueness lookups.
  toValueKey: (v: TStored) => string;
  // Display-time URL reconstruction (handle types only).
  toUrl?: (v: TStored) => string;
  subtype: ContactSubtypeRule;
  uniqueness: 'global-within-type' | 'per-owner';
  display: { label: string };
};

// ── Per-type definitions ────────────────────────────────────────────────────

export type PhoneValue = { e164: string; country: z.infer<typeof CountryCodeSchema> };
const phoneInputSchema = z.object({
  e164: z.string().regex(/^\+\d{7,15}$/, 'phone must be E.164 (+ followed by 7–15 digits)'),
  country: CountryCodeSchema,
});
const phoneDef: ContactTypeDef<PhoneValue, PhoneValue> = {
  inputSchema: phoneInputSchema,
  parseInput: (v) => v,
  valueSchema: phoneInputSchema,
  toValueKey: (v) => v.e164,
  subtype: { mode: 'optional', values: PHONE_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Phone' },
};

export type EmailValue = { address: string };
const emailInputSchema = z.object({ address: z.string().email() });
const emailDef: ContactTypeDef<EmailValue, EmailValue> = {
  inputSchema: emailInputSchema,
  parseInput: (v) => ({ address: v.address.toLowerCase() }),
  valueSchema: emailInputSchema,
  toValueKey: (v) => v.address,
  subtype: { mode: 'optional', values: EMAIL_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Email' },
};

export type WebsiteValue = { url: string };
const websiteInputSchema = z.object({ url: z.string().url() });
const websiteDef: ContactTypeDef<WebsiteValue, WebsiteValue> = {
  inputSchema: websiteInputSchema,
  parseInput: (v) => v,
  valueSchema: websiteInputSchema,
  toValueKey: (v) => canonicalUrl(v.url),
  subtype: { mode: 'optional', values: WEBSITE_SUBTYPES },
  uniqueness: 'per-owner',
  display: { label: 'Website' },
};

const linkedinStoredSchema = z.object({
  classifier: z.enum(LINKEDIN_CLASSIFIERS),
  handle: z.string().min(1),
});
type LinkedinInput = LinkedinValue | { url: string };
const linkedinInputSchema: z.ZodType<LinkedinInput> = z.union([
  z.object({ url: z.string().url() }),
  linkedinStoredSchema,
]);
const linkedinDef: ContactTypeDef<LinkedinInput, LinkedinValue> = {
  inputSchema: linkedinInputSchema,
  parseInput: (input) => ('url' in input ? parseLinkedinUrl(input.url) : input),
  valueSchema: linkedinStoredSchema,
  toValueKey: (v) => `${v.classifier}:${v.handle.toLowerCase()}`,
  toUrl: (v) =>
    `https://linkedin.com/${v.classifier === 'personal' ? 'in' : v.classifier}/${v.handle}`,
  subtype: { mode: 'forbidden' }, // classifier lives in `value`
  uniqueness: 'global-within-type',
  display: { label: 'LinkedIn' },
};

const githubStoredSchema = z.object({
  classifier: z.enum(GITHUB_CLASSIFIERS),
  handle: z.string().min(1),
});
type GithubInput = GithubValue | { url: string; classifier?: GithubValue['classifier'] };
const githubInputSchema: z.ZodType<GithubInput> = z.union([
  z.object({ url: z.string().url(), classifier: z.enum(GITHUB_CLASSIFIERS).optional() }),
  githubStoredSchema,
]);
const githubDef: ContactTypeDef<GithubInput, GithubValue> = {
  inputSchema: githubInputSchema,
  parseInput: (input) =>
    'url' in input ? parseGithubUrl(input.url, input.classifier) : input,
  valueSchema: githubStoredSchema,
  toValueKey: (v) => `${v.classifier}:${v.handle.toLowerCase()}`,
  toUrl: (v) => `https://github.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'GitHub' },
};

const twitterStoredSchema = z.object({ handle: z.string().min(1) });
type TwitterInput = TwitterValue | { url: string };
const twitterInputSchema: z.ZodType<TwitterInput> = z.union([
  z.object({ url: z.string().url() }),
  twitterStoredSchema,
]);
const twitterDef: ContactTypeDef<TwitterInput, TwitterValue> = {
  inputSchema: twitterInputSchema,
  parseInput: (input) => ('url' in input ? parseTwitterUrl(input.url) : input),
  valueSchema: twitterStoredSchema,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://x.com/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Twitter / X' },
};

export type WhatsappValue = { jid: string; displayName?: string };
const whatsappStoredSchema = z.object({
  jid: z.string().min(1),
  displayName: z.string().optional(),
});
const whatsappDef: ContactTypeDef<WhatsappValue, WhatsappValue> = {
  inputSchema: whatsappStoredSchema,
  parseInput: (v) => v,
  valueSchema: whatsappStoredSchema,
  toValueKey: (v) => v.jid,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'WhatsApp' },
};

const telegramStoredSchema = z.object({ handle: z.string().min(1) });
type TelegramInput = TelegramValue | { url: string };
const telegramInputSchema: z.ZodType<TelegramInput> = z.union([
  z.object({ url: z.string().url() }),
  telegramStoredSchema,
]);
const telegramDef: ContactTypeDef<TelegramInput, TelegramValue> = {
  inputSchema: telegramInputSchema,
  parseInput: (input) => ('url' in input ? parseTelegramUrl(input.url) : input),
  valueSchema: telegramStoredSchema,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl: (v) => `https://t.me/${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Telegram' },
};

export type DiscordValue = { userId: string; tag?: string };
const discordStoredSchema = z.object({
  userId: z.string().min(1),
  tag: z.string().optional(),
});
const discordDef: ContactTypeDef<DiscordValue, DiscordValue> = {
  inputSchema: discordStoredSchema,
  parseInput: (v) => v,
  valueSchema: discordStoredSchema,
  toValueKey: (v) => v.userId,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Discord' },
};

// ── Registry ────────────────────────────────────────────────────────────────
// biome-ignore lint/suspicious/noExplicitAny: per-type generics are heterogeneous; consumers narrow via ContactType.
export const ContactRegistry: Record<ContactType, ContactTypeDef<any, any>> = {
  phone: phoneDef,
  email: emailDef,
  website: websiteDef,
  linkedin: linkedinDef,
  github: githubDef,
  twitter: twitterDef,
  whatsapp: whatsappDef,
  telegram: telegramDef,
  discord: discordDef,
};
