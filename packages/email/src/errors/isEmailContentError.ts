/**
 * @atlas
 * @kind utils
 * @partOf feature:email
 * @uses none
 */
import { ConditionValidationError } from '@template/email/errors/ConditionValidationError';
import { DependentTemplateError } from '@template/email/errors/DependentTemplateError';
import { DivergentDuplicateSlugError } from '@template/email/errors/DivergentDuplicateSlugError';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { MjmlValidationError } from '@template/email/errors/MjmlValidationError';
import { ParseBlocksError } from '@template/email/errors/ParseBlocksError';
import { TokenValidationError } from '@template/email/errors/TokenValidationError';

const CONTENT_ERRORS = [
  ConditionValidationError,
  DependentTemplateError,
  DivergentDuplicateSlugError,
  EmailRenderError,
  MjmlValidationError,
  ParseBlocksError,
  TokenValidationError,
];

export const isEmailContentError = (error: unknown): boolean =>
  CONTENT_ERRORS.some((ContentError) => error instanceof ContentError);
