import type { IssueItem, PublicZodIssue } from './types';
import type { ZodError } from 'zod';

export function formatZodIssues(err: ZodError): PublicZodIssue[] {
  return err.issues.map((i: IssueItem) => ({
    path: i.path.join('.'),
    code: i.code,
    message: i.message,
  }));
}
