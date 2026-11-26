/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
import type { TimezoneId } from '@template/shared/reference/timezones';

export const formatDateTimeShort = (date: Date | string, timeZone: TimezoneId): string | null => {
  const at = new Date(date);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  // why: format() picks its joiner from the runtime's ICU data, so the string is assembled
  return `${part('month')} ${part('day')}, ${part('hour')}:${part('minute')} ${part('dayPeriod')} ${part('timeZoneName')}`;
};
