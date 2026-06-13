/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
export const ConcurrencyType = {
  db: 'db',
  redis: 'redis',
  queue: 'queue',
  socket: 'socket',
  appEvent: 'appEvent',
  integration: 'integration',
} as const;

export type ConcurrencyType = (typeof ConcurrencyType)[keyof typeof ConcurrencyType];

export const concurrencyLimits: Record<ConcurrencyType, number> = {
  [ConcurrencyType.db]: 10,
  [ConcurrencyType.redis]: 50,
  [ConcurrencyType.queue]: 100,
  [ConcurrencyType.socket]: 100,
  [ConcurrencyType.appEvent]: 100,
  [ConcurrencyType.integration]: 5,
};

export const getConcurrency = (types?: ConcurrencyType[]): number | undefined => {
  if (!types?.length) return undefined;
  return Math.min(...types.map((t) => concurrencyLimits[t]));
};
