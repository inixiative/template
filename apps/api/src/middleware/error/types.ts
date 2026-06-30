/**
 * @atlas
 * @kind middleware, type
 * @partOf primitive:errors
 * @uses none
 */
import type { ZodIssue } from 'zod';

export type IssueItem = ZodIssue;

export type PublicZodIssue = {
  path: string;
  code: string;
  message: string;
};
