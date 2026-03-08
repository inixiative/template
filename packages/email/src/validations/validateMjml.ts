/**
 * Validate MJML syntax. Throws MjmlValidationError if invalid.
 */

import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';
import mjml2html from 'mjml';

export const validateMjml = (mjml: string): void => {
  const result = mjml2html(mjml, { validationLevel: 'soft' });

  if (result.errors.length) throw new MjmlValidationError(result.errors);
};
