/**
 * @atlas
 * @kind registry
 * @partOf primitive:shared
 * @uses none
 */
export type ProjectResourceSpec = {
  readonly kind: string;
  readonly singularLabel: string;
  readonly pluralLabel: string;
  readonly defaultProjectName: (resource: {
    name: string;
    metadata?: Record<string, unknown> | null;
  }) => string;
};

export const PROJECT_RESOURCE_SPECS: Partial<Record<string, readonly ProjectResourceSpec[]>> = {
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific project-translatable resource kinds below
  // ==========================================================================
};

export const projectResourceSpecsFor = (
  provider: string | null | undefined,
): readonly ProjectResourceSpec[] => (provider ? (PROJECT_RESOURCE_SPECS[provider] ?? []) : []);

export const projectResourceSpecFor = (
  provider: string | null | undefined,
  kind: string,
): ProjectResourceSpec | undefined =>
  projectResourceSpecsFor(provider).find((spec) => spec.kind === kind);
