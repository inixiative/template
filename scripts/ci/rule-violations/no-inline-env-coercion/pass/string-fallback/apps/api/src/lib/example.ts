// `??` string fallbacks are allowed — only inline numeric/boolean coercion is forbidden.
export const fromName = process.env.PLATFORM_NAME ?? 'Template';
export const fromEmail = process.env.DEFAULT_FROM_EMAIL ?? 'noreply@example.com';
