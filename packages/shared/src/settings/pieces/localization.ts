/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
import { LanguageCodeSchema, TimezoneIdSchema } from '@template/shared/reference';

export const defaultTimezone = {
  valueType: 'text',
  schema: TimezoneIdSchema,
  defaultValue: 'UTC',
  label: 'Default Timezone',
  description: 'Canonical IANA timezone used for dates, schedules, and digests.',
} as const;

export const displayLocale = {
  valueType: 'text',
  schema: LanguageCodeSchema,
  defaultValue: 'en',
  label: 'Display Language',
  description: 'Preferred ISO-639-1 language code for copy and emails.',
} as const;
