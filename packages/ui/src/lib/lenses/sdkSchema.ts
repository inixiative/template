/**
 * @atlas
 * @kind type
 * @partOf primitive:ui
 * @uses none
 */

/** The JSON-schema shape the SDK emits (`as const` in `schemas.gen.ts`, inline in the spec). */
export type SdkSchema = {
  readonly type?: string | readonly string[];
  readonly format?: string;
  readonly enum?: readonly (string | number | null)[];
  readonly properties?: { readonly [key: string]: SdkSchema };
  readonly items?: SdkSchema;
};
