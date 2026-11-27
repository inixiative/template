/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
import { LANGUAGES } from '@template/shared/reference/languages';
import { TIMEZONE_IDS } from '@template/shared/reference/timezones';

export const defaultTimezone = {
  valueType: 'text',
  defaultValue: 'UTC',
  options: TIMEZONE_IDS.map((id) => ({ value: id, label: id })),
  label: 'Default Timezone',
  description: 'Canonical IANA timezone used for dates, schedules, and digests.',
} as const;

export const displayLocale = {
  valueType: 'text',
  defaultValue: 'en',
  options: LANGUAGES.map(({ code, name }) => ({ value: code, label: name })),
  label: 'Display Language',
  description: 'Preferred ISO-639-1 language code for copy and emails.',
} as const;
