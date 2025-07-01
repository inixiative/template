import { t } from 'elysia';

const baseError = t.Object({
  error: t.String(),
  message: t.String(),
  stack: t.Optional(t.String()),
  guidance: t.Optional(t.String())
});

export const errorResponses = {
  400: baseError,
  401: baseError,
  403: baseError,
  404: baseError,
  409: baseError,
  422: baseError,
  500: baseError
};