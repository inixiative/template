import type { ZodError } from 'zod';
import type { IssueItem, PublicZodIssue } from '#/middleware/error/types';

export const formatZodIssues = (err: ZodError): PublicZodIssue[] => {
  return err.issues.map((i: IssueItem) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
};
