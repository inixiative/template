import type { ContactType } from '@template/db/generated/client/enums';
import {
  type ContactTypeDef,
  discordDef,
  emailDef,
  githubDef,
  linkedinDef,
  phoneDef,
  telegramDef,
  twitterDef,
  websiteDef,
  whatsappDef,
} from '@template/shared/contact/defs';

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
