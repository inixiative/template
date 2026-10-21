/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
export type RuleNode = {
  kind: 'all' | 'any' | 'ifThenElse' | 'rule' | 'date' | 'array' | 'aggregate' | 'boolean';
  required: string[];
  optional: string[];
  description: string;
};

export const ruleNodes: RuleNode[] = [
  {
    kind: 'all',
    required: ['all'],
    optional: ['error'],
    description: 'True when every condition in `all` is true. `{ all: [] }` is true.',
  },
  {
    kind: 'any',
    required: ['any'],
    optional: ['error'],
    description: 'True when at least one condition in `any` is true. `{ any: [] }` is false.',
  },
  {
    kind: 'ifThenElse',
    required: ['if', 'then'],
    optional: ['else', 'error'],
    description: 'Evaluates `then` when `if` holds, otherwise `else` (true when `else` is absent).',
  },
  {
    kind: 'rule',
    required: ['field', 'operator'],
    optional: ['value', 'path', 'caseInsensitive', 'error'],
    description:
      'Compares a scalar field with an operator from `operators.field[<field kind>]`. The operand is `value` (its shape is `valueShapes.field[<operator>]`) or `path`, another field on the same row; operators whose shape is `none` take neither.',
  },
  {
    kind: 'date',
    required: ['field', 'dateOperator'],
    optional: ['value', 'path', 'error'],
    description:
      'Compares a DateTime field with an operator from `operators.date.DateTime`. `value` is an ISO date, a `[from, to]` pair, or a relative expression such as `{ ago: { days: 30 } }`; its shape is `valueShapes.date[<dateOperator>]`.',
  },
  {
    kind: 'array',
    required: ['field', 'arrayOperator'],
    optional: ['condition', 'count', 'error'],
    description:
      'Tests a to-many relation. `condition` applies to each related row and names its fields relative to that row. `all`, `any` and `none` require `condition`; `atLeast`, `atMost` and `exactly` take `count`; `empty` and `notEmpty` take neither.',
  },
  {
    kind: 'aggregate',
    required: ['field', 'aggregate', 'operator', 'value'],
    optional: ['condition', 'error'],
    description:
      'Sums or averages `aggregate.field` across a to-many relation (`aggregate.mode` is `sum` or `avg`), optionally over the rows matching `condition`, and compares the result with an operator from `operators.aggregate`.',
  },
  {
    kind: 'boolean',
    required: [],
    optional: [],
    description: 'A literal `true` or `false`.',
  },
];
