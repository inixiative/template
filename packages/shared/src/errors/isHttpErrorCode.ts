/**
 * @atlas
 * @kind helper, error
 * @partOf primitive:shared
 * @uses none
 */
import { HTTP_ERROR_MAP, type HttpErrorCode } from '@template/shared/errors/types';

export const isHttpErrorCode = (status: number): status is HttpErrorCode =>
  status in HTTP_ERROR_MAP;
