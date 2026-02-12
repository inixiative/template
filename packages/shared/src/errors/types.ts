/**
 * HTTP Error Map
 *
 * Canonical mapping from HTTP status codes to stable labels, names, and default guidance.
 * All types are derived from this map to prevent drift.
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

/**
 * Supported HTTP error codes
 */
export type HttpErrorCode = keyof typeof HTTP_ERROR_MAP;

/**
 * Stable machine labels for error identification (analytics, contracts)
 */
export type ErrorLabel = (typeof HTTP_ERROR_MAP)[HttpErrorCode]['label'];

/**
 * Guidance values for error handling behavior
 *
 * - fixInput: User needs to correct their input
 * - tryAgain: Temporary issue, retry may succeed
 * - reauthenticate: Session expired, re-login required
 * - requestPermission: User lacks necessary permissions
 * - refreshAndRetry: Refresh page and try again
 * - contactSupport: System issue requiring support intervention
 */
export type Guidance = (typeof HTTP_ERROR_MAP)[HttpErrorCode]['guidance'];

/**
 * Standard API error response body shape
 */
export type ApiErrorBody = {
  /** Stable machine label for analytics/logging */
  error: ErrorLabel;
  /** User-safe error message */
  message: string;
  /** Guidance for error handling behavior */
  guidance: Guidance;
  /** Field-level validation errors (for forms) */
  fieldErrors?: Record<string, string[]>;
  /** Request ID for support/debugging */
  requestId: string;
};
