/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
export const HTTP_ERROR_MAP = {
  // 4xx Client Errors
  400: { label: 'BAD_REQUEST', name: 'Bad Request', guidance: 'fixInput' },
  401: { label: 'AUTHENTICATION_FAILED', name: 'Unauthorized', guidance: 'reauthenticate' },
  403: { label: 'PERMISSION_DENIED', name: 'Forbidden', guidance: 'requestPermission' },
  404: { label: 'RESOURCE_NOT_FOUND', name: 'Not Found', guidance: 'fixInput' },
  405: { label: 'METHOD_NOT_ALLOWED', name: 'Method Not Allowed', guidance: 'contactSupport' },
  409: { label: 'CONFLICT', name: 'Conflict', guidance: 'fixInput' },
  410: { label: 'RESOURCE_GONE', name: 'Gone', guidance: 'fixInput' },
  413: { label: 'PAYLOAD_TOO_LARGE', name: 'Payload Too Large', guidance: 'fixInput' },
  415: { label: 'UNSUPPORTED_MEDIA_TYPE', name: 'Unsupported Media Type', guidance: 'contactSupport' },
  422: { label: 'VALIDATION_ERROR', name: 'Unprocessable Entity', guidance: 'fixInput' },
  429: { label: 'RATE_LIMITED', name: 'Too Many Requests', guidance: 'tryAgain' },

  // 5xx Server Errors
  500: { label: 'SERVER_ERROR', name: 'Internal Server Error', guidance: 'contactSupport' },
  502: { label: 'BAD_GATEWAY', name: 'Bad Gateway', guidance: 'tryAgain' },
  503: { label: 'SERVICE_UNAVAILABLE', name: 'Service Unavailable', guidance: 'refreshAndRetry' },
  504: { label: 'GATEWAY_TIMEOUT', name: 'Gateway Timeout', guidance: 'tryAgain' },
} as const;

export type HttpErrorCode = keyof typeof HTTP_ERROR_MAP;

export type ErrorLabel = (typeof HTTP_ERROR_MAP)[HttpErrorCode]['label'];

export type Guidance = (typeof HTTP_ERROR_MAP)[HttpErrorCode]['guidance'];

export type ApiErrorBody = {
  error: ErrorLabel;
  message: string;
  guidance: Guidance;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
};
