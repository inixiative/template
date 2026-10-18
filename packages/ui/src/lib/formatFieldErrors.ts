/**
 * @atlas
 * @kind helper, error
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import type { ApiErrorBody } from '@template/shared/errors';

export const formatFieldErrors = (fieldErrors: NonNullable<ApiErrorBody['fieldErrors']>) =>
  Object.entries(fieldErrors)
    .flatMap(([path, messages]) =>
      messages.map((message) => (path ? `${path}: ${message}` : message)),
    )
    .join('; ');
