/**
 * Build a deterministic pseudo-email domain for stub Users, namespaced by
 * contact type and project. Reads `PROJECT_NAME` so each fork gets its own
 * non-conflicting domain (`whatsapp.template`, `whatsapp.tribe`, etc.).
 */
export const stubEmailDomain = (type: string): string => {
  const project = process.env.PROJECT_NAME ?? 'app';
  return `${type}.${project}`;
};

/**
 * Build a deterministic pseudo-email for stub Users from a phone-shaped
 * source. Strips all non-digits so the output is shape-stable regardless of
 * the input formatting (E.164 with `+`, jid with `@s.whatsapp.net`, etc.).
 *
 * Used by ContactTypeDef.toStubEmail for phone-derived contact types
 * (whatsapp, phone). Telegram uses its handle directly — see telegramDef.
 */
export const phoneToStubEmail = (rawDigits: string, type: string): string => {
  const digits = rawDigits.replace(/[^0-9]/g, '');
  return `${digits}@${stubEmailDomain(type)}`;
};
