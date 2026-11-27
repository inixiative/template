/**
 * @atlas
 * @kind component
 * @partOf feature:integrations, feature:project, primitive:ui
 * @uses primitive:sdk, primitive:ui
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { IntegrationCreateManyProjectIntegrationsData } from '@template/sdk';
import {
  isProjectCompatibleWithIntegration,
  type ProjectResourceSpec,
  projectResourceSpecsFor,
} from '@template/shared/integrations';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from '@template/ui/components/primitives';
import { describeError } from '@template/ui/lib/describeError';
import {
  type IntegrationSummaryRecord,
  integrationCreateManyProjectIntegrationsMutationFn,
  integrationReadManyIntegrationResourcesQueryOptions,
  integrationReadManyProjectIntegrationsQueryOptions,
  type ProjectRecord,
  projectIntegrationResourceDeleteMutationFn,
} from '@template/ui/lib/projectContextQueries';
import { groupBy, isPlainObject, keyBy } from 'lodash-es';
import { useEffect, useMemo, useState } from 'react';

const CREATE_NEW_PROJECT = '__new__';
const SKIP_RESOURCE = '__skip__';

type ResourceProjectAssignment = {
  projectSelection: string;
  isIdentity: boolean;
};

type ExistingResourceAssignment = {
  id: string;
  integrationResourceId: string;
  projectId: string;
  projectName: string;
  isIdentity: boolean;
};

export type IntegrationProjectsSetupIntegration = Pick<
  IntegrationSummaryRecord,
  'id' | 'name' | 'provider' | 'userId' | 'organizationId' | 'spaceId'
>;

export type IntegrationProjectsSetupProps = {
  integration: IntegrationProjectsSetupIntegration;
  projects: readonly ProjectRecord[];
  projectResourceSpecs?: readonly ProjectResourceSpec[];
  onRefreshResources?: () => Promise<unknown>;
  refreshLabel?: string;
  onComplete?: () => void;
  onSkip?: () => void;
};

const defaultProjectNameFor = (
  resource: { name: string; metadata?: unknown },
  spec: ProjectResourceSpec,
): string =>
  spec.defaultProjectName({
    name: resource.name,
    metadata: isPlainObject(resource.metadata)
      ? (resource.metadata as Record<string, unknown>)
      : null,
  });

export const IntegrationProjectsSetup = ({
  integration,
  projects,
  projectResourceSpecs,
  onRefreshResources,
  refreshLabel = 'Refresh',
  onComplete,
  onSkip,
}: IntegrationProjectsSetupProps) => {
  const queryClient = useQueryClient();
  const specs = useMemo(
    () => projectResourceSpecs ?? projectResourceSpecsFor(integration.provider),
    [projectResourceSpecs, integration.provider],
  );
  const specsByKind = useMemo(() => keyBy(specs, 'kind'), [specs]);

  const resourcesQueryOptions = useMemo(
    () => integrationReadManyIntegrationResourcesQueryOptions(integration.id),
    [integration.id],
  );
  const projectIntegrationsQueryOptions = useMemo(
    () => integrationReadManyProjectIntegrationsQueryOptions(integration.id),
    [integration.id],
  );

  const resourcesQuery = useQuery({
    ...resourcesQueryOptions,
    enabled: specs.length > 0,
  });
  const projectIntegrationsQuery = useQuery({
    ...projectIntegrationsQueryOptions,
    enabled: specs.length > 0,
  });

  const [assignments, setAssignments] = useState<Record<string, ResourceProjectAssignment>>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setAssignments({});
    setNotice('');
    setErrorMessage('');
  }, [integration.id]);

  const compatibleProjects = useMemo(
    () => projects.filter((project) => isProjectCompatibleWithIntegration(project, integration)),
    [projects, integration],
  );

  const mappedIntegrationResources = useMemo(
    () =>
      (resourcesQuery.data?.data ?? []).filter(
        (resource) => resource.status === 'tracked' && Boolean(specsByKind[resource.kind]),
      ),
    [resourcesQuery.data, specsByKind],
  );

  const mappedResourceIds = useMemo(
    () => new Set(mappedIntegrationResources.map((resource) => resource.id)),
    [mappedIntegrationResources],
  );

  const existingAssignmentsByResourceId = useMemo(() => {
    const flattened: ExistingResourceAssignment[] = (
      projectIntegrationsQuery.data?.data ?? []
    ).flatMap((projectIntegration) =>
      projectIntegration.projectIntegrationResources.map((projectIntegrationResource) => ({
        id: projectIntegrationResource.id,
        integrationResourceId: projectIntegrationResource.integrationResourceId,
        projectId: projectIntegration.projectId,
        projectName: projectIntegration.project.name,
        isIdentity: projectIntegrationResource.isIdentity,
      })),
    );
    return groupBy(flattened, 'integrationResourceId');
  }, [projectIntegrationsQuery.data]);

  const projectIntegrationsTruncated =
    (projectIntegrationsQuery.data?.pagination?.totalPages ?? 1) > 1;
  const resourcesTruncated = (resourcesQuery.data?.pagination?.totalPages ?? 1) > 1;

  if (specs.length === 0) return null;

  const isLoading = resourcesQuery.isLoading || projectIntegrationsQuery.isLoading;
  const queryError = resourcesQuery.error ?? projectIntegrationsQuery.error;

  const defaultAssignmentFor = (integrationResourceId: string): ResourceProjectAssignment => {
    const primaryAssignment = existingAssignmentsByResourceId[integrationResourceId]?.[0];
    if (primaryAssignment) {
      return {
        projectSelection: primaryAssignment.projectId,
        isIdentity: primaryAssignment.isIdentity,
      };
    }
    if (projectIntegrationsTruncated) {
      return { projectSelection: SKIP_RESOURCE, isIdentity: false };
    }
    return { projectSelection: CREATE_NEW_PROJECT, isIdentity: true };
  };

  const assignmentFor = (integrationResourceId: string): ResourceProjectAssignment =>
    assignments[integrationResourceId] ?? defaultAssignmentFor(integrationResourceId);

  const setAssignment = (integrationResourceId: string, next: ResourceProjectAssignment) =>
    setAssignments((prev) => {
      const updated: Record<string, ResourceProjectAssignment> = {
        ...prev,
        [integrationResourceId]: next,
      };
      if (
        next.isIdentity &&
        next.projectSelection !== CREATE_NEW_PROJECT &&
        next.projectSelection !== SKIP_RESOURCE
      ) {
        for (const other of mappedIntegrationResources) {
          if (other.id === integrationResourceId) continue;
          const otherAssignment = prev[other.id] ?? defaultAssignmentFor(other.id);
          if (
            otherAssignment.projectSelection === next.projectSelection &&
            otherAssignment.isIdentity
          ) {
            updated[other.id] = { ...otherAssignment, isIdentity: false };
          }
        }
      }
      return updated;
    });

  const hasOtherIdentityForProject = (
    integrationResourceId: string,
    projectId: string,
  ): boolean => {
    const inMappedResources = mappedIntegrationResources.some((other) => {
      if (other.id === integrationResourceId) return false;
      const otherAssignment = assignmentFor(other.id);
      return otherAssignment.projectSelection === projectId && otherAssignment.isIdentity;
    });
    if (inMappedResources) return true;

    const loadedProjectIntegration = (projectIntegrationsQuery.data?.data ?? []).find(
      (projectIntegration) => projectIntegration.projectId === projectId,
    );
    return (loadedProjectIntegration?.projectIntegrationResources ?? []).some(
      (resourceLink) =>
        resourceLink.isIdentity &&
        resourceLink.integrationResourceId !== integrationResourceId &&
        !mappedResourceIds.has(resourceLink.integrationResourceId),
    );
  };

  const handleSaveProjects = async () => {
    setPending(true);
    setNotice('');
    setErrorMessage('');
    let mutated = false;
    try {
      const projectIntegrationResourceIdsToDelete: string[] = [];
      const newProjectDrafts: {
        defaultName: string;
        fallbackName: string;
        integrationResourceId: string;
        isIdentity: boolean;
      }[] = [];
      const existingResourceUpdates: {
        projectId: string;
        integrationResourceId: string;
        isIdentity: boolean;
      }[] = [];

      for (const resource of mappedIntegrationResources) {
        const existingAssignments = existingAssignmentsByResourceId[resource.id] ?? [];
        const primaryAssignment = existingAssignments[0];
        const current = defaultAssignmentFor(resource.id);
        const selected = assignmentFor(resource.id);
        const changed =
          (!primaryAssignment && selected.projectSelection !== SKIP_RESOURCE) ||
          selected.projectSelection !== current.projectSelection ||
          selected.isIdentity !== current.isIdentity;
        if (!changed) continue;

        // Only unlink the row's own displayed assignment so links from other projects remain intact.
        if (primaryAssignment && primaryAssignment.projectId !== selected.projectSelection) {
          projectIntegrationResourceIdsToDelete.push(primaryAssignment.id);
        }

        if (selected.projectSelection === SKIP_RESOURCE) continue;

        if (selected.projectSelection === CREATE_NEW_PROJECT) {
          const spec = specsByKind[resource.kind]!;
          newProjectDrafts.push({
            defaultName: defaultProjectNameFor(resource, spec),
            fallbackName: resource.name,
            integrationResourceId: resource.id,
            isIdentity: selected.isIdentity,
          });
          continue;
        }

        existingResourceUpdates.push({
          projectId: selected.projectSelection,
          integrationResourceId: resource.id,
          isIdentity: selected.isIdentity,
        });
      }

      const defaultNameCounts = groupBy(newProjectDrafts, 'defaultName');
      const newProjectItems: IntegrationCreateManyProjectIntegrationsData['body'] =
        newProjectDrafts.map((draft) => ({
          project: {
            name:
              (defaultNameCounts[draft.defaultName]?.length ?? 0) > 1
                ? draft.fallbackName
                : draft.defaultName,
          },
          resources: [
            {
              integrationResourceId: draft.integrationResourceId,
              isIdentity: draft.isIdentity,
            },
          ],
        }));

      const groupedExistingItems: IntegrationCreateManyProjectIntegrationsData['body'] =
        Object.entries(groupBy(existingResourceUpdates, 'projectId')).map(
          ([projectId, resources]) => ({
            projectId,
            resources: resources.map(({ integrationResourceId, isIdentity }) => ({
              integrationResourceId,
              isIdentity,
            })),
          }),
        );

      for (const projectIntegrationResourceId of projectIntegrationResourceIdsToDelete) {
        await projectIntegrationResourceDeleteMutationFn({
          path: { id: projectIntegrationResourceId },
        });
        mutated = true;
      }

      const payload: IntegrationCreateManyProjectIntegrationsData['body'] = [
        ...newProjectItems,
        ...groupedExistingItems,
      ];

      if (payload.length > 0) {
        await integrationCreateManyProjectIntegrationsMutationFn({
          path: { id: integration.id },
          body: payload,
        });
        mutated = true;
      }

      setAssignments({});
      setNotice('Projects saved.');
      onComplete?.();
    } catch (error) {
      setErrorMessage(describeError(error, 'Failed to save projects.').message);
    } finally {
      if (mutated) {
        await queryClient.invalidateQueries({
          queryKey: projectIntegrationsQueryOptions.queryKey,
        });
      }
      setPending(false);
    }
  };

  const handleRefreshResources = async () => {
    if (!onRefreshResources) return;
    setPending(true);
    setNotice('');
    setErrorMessage('');
    try {
      await onRefreshResources();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourcesQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: projectIntegrationsQueryOptions.queryKey }),
      ]);
      setAssignments({});
      setNotice('Resources refreshed.');
    } catch (error) {
      setErrorMessage(describeError(error, 'Failed to refresh resources.').message);
    } finally {
      setPending(false);
    }
  };

  const sectionHeading =
    specs.length === 1 ? `${specs[0]!.pluralLabel} as projects` : 'Set up projects';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sectionHeading}</CardTitle>
        <CardDescription>
          Create a project for each resource {integration.name} reaches, link it to an existing
          project, or skip it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading resources…</p>}
        {!isLoading && queryError && (
          <p role="alert" className="text-sm text-destructive">
            {describeError(queryError, 'Failed to load integration resources.').message}
          </p>
        )}
        {!isLoading && !queryError && (resourcesTruncated || projectIntegrationsTruncated) && (
          <p className="text-sm text-muted-foreground">
            Showing the first 100 items. Unlinked defaults are set to Skip to avoid duplicating
            projects on later pages.
          </p>
        )}
        {!isLoading && !queryError && mappedIntegrationResources.length === 0 && (
          <p className="text-sm text-muted-foreground">No resources available yet.</p>
        )}
        {!isLoading &&
          !queryError &&
          mappedIntegrationResources.map((resource) => {
            const spec = specsByKind[resource.kind]!;
            const defaultName = defaultProjectNameFor(resource, spec);
            const selected = assignmentFor(resource.id);
            const existingResourceAssignments = existingAssignmentsByResourceId[resource.id] ?? [];
            const additionalProjectCount = Math.max(0, existingResourceAssignments.length - 1);
            const selectId = `integration-project-target-${resource.id}`;
            return (
              <div key={resource.id} className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor={selectId} className="block text-sm font-medium">
                    {resource.name}
                  </label>
                  <Select
                    id={selectId}
                    value={selected.projectSelection}
                    onChange={(projectSelection) =>
                      setAssignment(resource.id, {
                        projectSelection,
                        isIdentity:
                          projectSelection === CREATE_NEW_PROJECT
                            ? true
                            : projectSelection === SKIP_RESOURCE
                              ? false
                              : !hasOtherIdentityForProject(resource.id, projectSelection),
                      })
                    }
                    options={[
                      { value: CREATE_NEW_PROJECT, label: `New project: ${defaultName}` },
                      ...compatibleProjects.map((project) => ({
                        value: project.id,
                        label: project.name,
                      })),
                      ...existingResourceAssignments
                        .filter(
                          (assignment) =>
                            !compatibleProjects.some(
                              (project) => project.id === assignment.projectId,
                            ),
                        )
                        .map((assignment) => ({
                          value: assignment.projectId,
                          label: assignment.projectName,
                        })),
                      { value: SKIP_RESOURCE, label: 'Skip' },
                    ]}
                  />
                  {additionalProjectCount > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Also linked to {additionalProjectCount} other{' '}
                      {additionalProjectCount === 1 ? 'project' : 'projects'}.
                    </p>
                  )}
                </div>
                {selected.projectSelection !== SKIP_RESOURCE && (
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.isIdentity}
                      onChange={(event) =>
                        setAssignment(resource.id, {
                          ...selected,
                          isIdentity: event.target.checked,
                        })
                      }
                    />
                    Project identity
                  </label>
                )}
              </div>
            );
          })}
        {errorMessage && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            disabled={
              pending || isLoading || Boolean(queryError) || mappedIntegrationResources.length === 0
            }
            onClick={() => void handleSaveProjects()}
          >
            Save projects
          </Button>
          {onRefreshResources && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => void handleRefreshResources()}
            >
              {refreshLabel}
            </Button>
          )}
          {onSkip && (
            <Button variant="ghost" disabled={pending} onClick={onSkip}>
              Skip for now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
