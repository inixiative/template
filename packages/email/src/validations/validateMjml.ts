/**
 * Validate MJML syntax. Throws MjmlValidationError if invalid.
 */

import mjml2html from 'mjml';
import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';

export const validateMjml = (mjml: string): void => {
  const result = mjml2html(mjml, { validationLevel: 'soft' });

  if (result.errors.length) throw new MjmlValidationError(result.errors);
};
