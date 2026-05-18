
import { MjmlValidationError } from '@template/email/validations/MjmlValidationError';
import mjml2html from 'mjml';

export const validateMjml = async (mjml: string): Promise<void> => {
  const result = await mjml2html(mjml, { validationLevel: 'soft' });

  if (result.errors.length) throw new MjmlValidationError(result.errors);
};
