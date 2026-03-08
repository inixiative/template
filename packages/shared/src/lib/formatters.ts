const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

export const formatDate = (date: Date, locale: string, options?: Intl.DateTimeFormatOptions): string => {
  if (!isValidDate(date)) return '';
  return new Intl.DateTimeFormat(locale, options).format(date);
};

export const formatNumber = (value: number, locale: string, options?: Intl.NumberFormatOptions): string => {
  return new Intl.NumberFormat(locale, options).format(value);
};

export const formatCurrency = (amount: number, currency: string, locale: string): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

const relativeTimeUnits: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

export const formatRelativeTime = (date: Date, locale: string): string => {
  if (!isValidDate(date)) return '';

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  const match = relativeTimeUnits.find((item) => absMs >= item.ms) ?? relativeTimeUnits[relativeTimeUnits.length - 1];
  const value = Math.round(diffMs / match.ms);

  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, match.unit);
};
