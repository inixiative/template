import type { ZodError } from 'zod';
import type { IssueItem, PublicZodIssue } from './types';

export function formatZodIssues(err: ZodError): PublicZodIssue[] {
  return err.issues.map((i: IssueItem) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
}
