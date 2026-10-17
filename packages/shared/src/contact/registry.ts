/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses infrastructure:prisma
 */
import type { ContactType } from '@template/db/generated/client/enums';
import {
  blueskyDef,
  type ContactTypeDef,
  discordDef,
  emailDef,
  facebookDef,
  githubDef,
  instagramDef,
  lineDef,
  linkedinDef,
  mastodonDef,
  phoneDef,
  redditDef,
  signalDef,
  skypeDef,
  telegramDef,
  threadsDef,
  tiktokDef,
  twitterDef,
  viberDef,
  websiteDef,
  wechatDef,
  whatsappDef,
  youtubeDef,
} from '@template/shared/contact/defs';

const contactDefs = {
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

type ContactDefs = typeof contactDefs;
export type ContactInput<K extends ContactType> = Parameters<ContactDefs[K]['parseInput']>[0];
export type ContactValue<K extends ContactType> = ReturnType<ContactDefs[K]['parseInput']>;

export const ContactRegistry: {
  [K in ContactType]: ContactTypeDef<ContactInput<K>, ContactValue<K>>;
} = contactDefs;
