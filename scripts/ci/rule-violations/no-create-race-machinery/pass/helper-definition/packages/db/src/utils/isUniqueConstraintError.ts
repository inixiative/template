export const isUniqueConstraintError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 'P2002';
