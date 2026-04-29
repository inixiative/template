import type { ContactType } from '@template/db/generated/client/enums';
import { CountryCodeSchema } from '@template/shared/reference/countries';
import {
  canonicalUrl,
  type BlueskyValue,
  type FacebookValue,
  type GithubValue,
  type InstagramValue,
  type LinkedinValue,
  type MastodonValue,
  parseBlueskyUrl,
  parseFacebookUrl,
  parseGithubUrl,
  parseInstagramUrl,
  parseLinkedinUrl,
  parseMastodonHandle,
  parseRedditUrl,
  parseTelegramUrl,
  parseThreadsUrl,
  parseTiktokUrl,
  parseTwitterUrl,
  parseYoutubeUrl,
  type RedditValue,
  type TelegramValue,
  type ThreadsValue,
  type TiktokValue,
  type TwitterValue,
  type YoutubeValue,
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

// ── New platform defs ────────────────────────────────────────────────────────

const handleStoredSchema = z.object({ handle: z.string().min(1) });
type HandleInput = { handle: string } | { url: string };

const makeHandleDef = (
  label: string,
  parseUrl: (url: string) => { handle: string },
  toUrl: (v: { handle: string }) => string,
): ContactTypeDef<HandleInput, { handle: string }> => ({
  inputSchema: z.union([z.object({ url: z.string().url() }), handleStoredSchema]) as z.ZodType<HandleInput>,
  parseInput: (input) => ('url' in input ? parseUrl(input.url) : input),
  valueSchema: handleStoredSchema,
  toValueKey: (v) => v.handle.toLowerCase(),
  toUrl,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label },
});

const instagramDef = makeHandleDef(
  'Instagram',
  parseInstagramUrl,
  (v: InstagramValue) => `https://instagram.com/${v.handle}`,
);

const facebookDef = makeHandleDef(
  'Facebook',
  parseFacebookUrl,
  (v: FacebookValue) => `https://facebook.com/${v.handle}`,
);

const youtubeDef = makeHandleDef(
  'YouTube',
  parseYoutubeUrl,
  (v: YoutubeValue) => `https://youtube.com/@${v.handle}`,
);

const tiktokDef = makeHandleDef(
  'TikTok',
  parseTiktokUrl,
  (v: TiktokValue) => `https://tiktok.com/@${v.handle}`,
);

const blueskyDef = makeHandleDef(
  'Bluesky',
  parseBlueskyUrl,
  (v: BlueskyValue) => `https://bsky.app/profile/${v.handle}`,
);

const threadsDef = makeHandleDef(
  'Threads',
  parseThreadsUrl,
  (v: ThreadsValue) => `https://threads.net/@${v.handle}`,
);

const redditDef = makeHandleDef(
  'Reddit',
  parseRedditUrl,
  (v: RedditValue) => `https://www.reddit.com/u/${v.handle}`,
);

const mastodonStoredSchema = z.object({
  handle: z.string().min(1),
  server: z.string().min(1),
});
type MastodonInput = MastodonValue | { url: string };
const mastodonInputSchema: z.ZodType<MastodonInput> = z.union([
  z.object({ url: z.string() }),
  mastodonStoredSchema,
]);
const mastodonDef: ContactTypeDef<MastodonInput, MastodonValue> = {
  inputSchema: mastodonInputSchema,
  parseInput: (input) => ('url' in input ? parseMastodonHandle(input.url) : input),
  valueSchema: mastodonStoredSchema,
  toValueKey: (v) => `${v.handle.toLowerCase()}@${v.server.toLowerCase()}`,
  toUrl: (v) => `https://${v.server}/@${v.handle}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Mastodon' },
};

const e164Schema = z.string().regex(/^\+\d{7,15}$/, 'must be E.164 (+ followed by 7–15 digits)');

export type SignalValue = { e164: string };
const signalStoredSchema = z.object({ e164: e164Schema });
const signalDef: ContactTypeDef<SignalValue, SignalValue> = {
  inputSchema: signalStoredSchema,
  parseInput: (v) => v,
  valueSchema: signalStoredSchema,
  toValueKey: (v) => v.e164,
  toUrl: (v) => `https://signal.me/#p/${v.e164}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Signal' },
};

export type ViberValue = { e164: string };
const viberStoredSchema = z.object({ e164: e164Schema });
const viberDef: ContactTypeDef<ViberValue, ViberValue> = {
  inputSchema: viberStoredSchema,
  parseInput: (v) => v,
  valueSchema: viberStoredSchema,
  toValueKey: (v) => v.e164,
  toUrl: (v) => `viber://chat?number=${encodeURIComponent(v.e164)}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Viber' },
};

export type LineValue = { lineId: string };
const lineDef: ContactTypeDef<LineValue, LineValue> = {
  inputSchema: z.object({ lineId: z.string().min(1) }),
  parseInput: (v) => v,
  valueSchema: z.object({ lineId: z.string().min(1) }),
  toValueKey: (v) => v.lineId.toLowerCase(),
  toUrl: (v) => `https://line.me/ti/p/~${v.lineId}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'LINE' },
};

export type WechatValue = { wechatId: string };
const wechatDef: ContactTypeDef<WechatValue, WechatValue> = {
  inputSchema: z.object({ wechatId: z.string().min(1) }),
  parseInput: (v) => v,
  valueSchema: z.object({ wechatId: z.string().min(1) }),
  toValueKey: (v) => v.wechatId.toLowerCase(),
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'WeChat' },
};

export type SkypeValue = { skypeId: string };
const skypeDef: ContactTypeDef<SkypeValue, SkypeValue> = {
  inputSchema: z.object({ skypeId: z.string().min(1) }),
  parseInput: (v) => v,
  valueSchema: z.object({ skypeId: z.string().min(1) }),
  toValueKey: (v) => v.skypeId.toLowerCase(),
  toUrl: (v) => `https://join.skype.com/invite/${v.skypeId}`,
  subtype: { mode: 'forbidden' },
  uniqueness: 'global-within-type',
  display: { label: 'Skype' },
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
  instagram: instagramDef,
  facebook: facebookDef,
  youtube: youtubeDef,
  tiktok: tiktokDef,
  bluesky: blueskyDef,
  threads: threadsDef,
  reddit: redditDef,
  signal: signalDef,
  mastodon: mastodonDef,
  line: lineDef,
  wechat: wechatDef,
  viber: viberDef,
  skype: skypeDef,
};
