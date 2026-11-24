/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */

/** Uniform 5-column contract carried by every model registered in ATTRIBUTE_MODELS. */
export const ATTRIBUTE_COLUMN_NAMES = [
  'valueBoolean',
  'valueText',
  'valueNumber',
  'valueDate',
  'valueJson',
] as const;

export type AttributeColumnName = (typeof ATTRIBUTE_COLUMN_NAMES)[number];

/** Typed value columns stored on any Attribute-capable model (e.g. Setting). */
export type AttributeTypedColumns = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | string | null;
  valueJson: unknown;
};

/** Encoded columns produced for writes: at most one column populated, the other four null. */
export type AttributeEncodedColumns = {
  valueBoolean: boolean | null;
  valueText: string | null;
  valueNumber: number | null;
  valueDate: Date | null;
  valueJson: unknown;
};

export const EMPTY_ATTRIBUTE_COLUMNS: AttributeEncodedColumns = {
  valueBoolean: null,
  valueText: null,
  valueNumber: null,
  valueDate: null,
  valueJson: null,
};

export type AttributeValidationIssue = {
  code: string;
  message: string;
  path?: string[];
};

export class AttributeValidationError extends Error {
  readonly issues: AttributeValidationIssue[];

  constructor(issues: AttributeValidationIssue[], message?: string) {
    super(message ?? issues.map((issue) => issue.message).join('; '));
    this.name = 'AttributeValidationError';
    this.issues = issues;
  }
}
