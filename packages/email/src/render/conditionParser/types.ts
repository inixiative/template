/**
 * @atlas
 * @kind parser
 * @partOf feature:email
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';

export type Branch = {
  kind: 'if' | 'elseIf' | 'else';
  rule?: Condition;
  ruleError?: string;
  body: string;
};

export type IfBlock = { branches: Branch[]; end: number };

export type EachBlock = {
  path: string;
  as?: string;
  asMissing?: boolean;
  index?: string;
  filter?: Condition;
  filterError?: string;
  attributeErrors?: string[];
  body: string;
  end: number;
};
