/**
 * @atlas
 * @kind constant
 * @partOf feature:integrations, feature:project
 * @uses none
 */
export type ProjectResourceSpec = {
  kind: string;
  pluralLabel: string;
  defaultProjectName: (resource: {
    name: string;
    metadata?: Record<string, unknown> | null;
  }) => string;
};

export type OwnerScopeBoundary = {
  organizationId: string | null;
  spaceId: string | null;
  userId: string | null;
};

/**
 * Checks whether an Integration can legally link to a Project under the tenant
 * containment rules. Returns a 422-safe violation message or `null` when valid.
 */
export const projectIntegrationOwnerViolation = (
  project: OwnerScopeBoundary,
  integration: OwnerScopeBoundary,
): string | null => {
  if (project.organizationId !== integration.organizationId) {
    return 'Project and Integration must belong to the same organization';
  }
  if (integration.spaceId !== null && project.spaceId !== integration.spaceId) {
    return 'Space-scoped Integration can only attach to a Project in the same space';
  }
  if (integration.userId !== null && project.userId !== integration.userId) {
    return 'User-scoped Integration can only attach to a Project owned by the same user';
  }
  if (project.organizationId === null && project.userId !== integration.userId) {
    return 'Personal Project and Integration must belong to the same user';
  }
  return null;
};

export const isProjectCompatibleWithIntegration = (
  project: OwnerScopeBoundary,
  integration: OwnerScopeBoundary,
): boolean => projectIntegrationOwnerViolation(project, integration) === null;

/**
 * App-level registry mapping Integration providers to the IntegrationResource
 * kinds that can be turned into or linked as Projects (R-2026-11-24-04).
 */
export const PROJECT_RESOURCE_SPECS: Readonly<Record<string, readonly ProjectResourceSpec[]>> = {
  // TEMPLATE ABOVE
};

export const projectResourceSpecsFor = (
  provider: string | null | undefined,
): readonly ProjectResourceSpec[] => (provider ? (PROJECT_RESOURCE_SPECS[provider] ?? []) : []);
