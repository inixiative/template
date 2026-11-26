/**
 * @atlas
 * @kind component
 * @partOf feature:integrations, feature:project, primitive:ui
 * @uses primitive:sdk, primitive:ui
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type IntegrationCreateManyProjectIntegrationsData,
  integrationCreateManyProjectIntegrations,
  integrationReadManyIntegrationResources,
  integrationReadManyIntegrationResourcesQueryKey,
  integrationReadManyProjectIntegrations,
  integrationReadManyProjectIntegrationsQueryKey,
  projectIntegrationResourceDelete,
} from '@template/sdk';
import { type ProjectResourceSpec, projectResourceSpecsFor } from '@template/shared/integrations';
import { Button, Select } from '@template/ui/components/primitives';
import { apiMutation } from '@template/ui/lib/apiMutation';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type {
  IntegrationSummaryRecord,
  ProjectRecord,
} from '@template/ui/lib/projectContextQueries';
import { useMemo, useState } from 'react';

const NEW_PROJECT = '__new__';
const SKIP = '__skip__';

type ChoiceState = {
  target: string;
  isIdentity: boolean;
};

type IntegrationTarget = Pick<
  IntegrationSummaryRecord,
  'id' | 'name' | 'provider' | 'ownerModel' | 'userId' | 'organizationId' | 'spaceId'
>;

export type IntegrationProjectsSetupProps = {
  integration: IntegrationTarget;
  projects: readonly ProjectRecord[];
  resourceSpecs?: readonly ProjectResourceSpec[];
  onRefreshResources?: () => Promise<unknown>;
  refreshLabel?: string;
  onComplete?: () => void;
  onSkip?: () => void;
};

const isProjectCompatibleWithIntegration = (
  project: ProjectRecord,
  integration: IntegrationTarget,
): boolean => {
  if (project.organizationId !== integration.organizationId) return false;
  if (integration.spaceId !== null && project.spaceId !== integration.spaceId) return false;
  if (integration.userId !== null && project.userId !== integration.userId) return false;
  if (project.organizationId === null && project.userId !== integration.userId) return false;
  return true;
};

const defaultProjectNameFor = (
  resource: { name: string; metadata?: unknown },
  spec?: ProjectResourceSpec,
): string => {
  if (!spec) return resource.name;
  return spec.defaultProjectName({
    name: resource.name,
    metadata:
      typeof resource.metadata === 'object' && resource.metadata !== null
        ? (resource.metadata as Record<string, unknown>)
        : null,
  });
};

export const IntegrationProjectsSetup = ({
  integration,
  projects,
  resourceSpecs,
  onRefreshResources,
  refreshLabel = 'Refresh',
  onComplete,
  onSkip,
}: IntegrationProjectsSetupProps) => {
  const queryClient = useQueryClient();
  const specs = useMemo(
    () => resourceSpecs ?? projectResourceSpecsFor(integration.provider),
    [resourceSpecs, integration.provider],
  );
  const specsByKind = useMemo(() => new Map(specs.map((spec) => [spec.kind, spec])), [specs]);

  const resourcesQueryKey = integrationReadManyIntegrationResourcesQueryKey({
    path: { id: integration.id },
    query: { pageSize: 100 },
  });
  const linksQueryKey = integrationReadManyProjectIntegrationsQueryKey({
    path: { id: integration.id },
    query: { pageSize: 100 },
  });

  const resourcesQuery = useQuery({
    queryKey: resourcesQueryKey,
    enabled: specs.length > 0,
    queryFn: apiQuery((opts: Parameters<typeof integrationReadManyIntegrationResources>[0]) =>
      integrationReadManyIntegrationResources({
        ...opts,
        path: { id: integration.id },
        query: { pageSize: 100 },
        throwOnError: true,
      }),
    ),
  });

  const linksQuery = useQuery({
    queryKey: linksQueryKey,
    enabled: specs.length > 0,
    queryFn: apiQuery((opts: Parameters<typeof integrationReadManyProjectIntegrations>[0]) =>
      integrationReadManyProjectIntegrations({
        ...opts,
        path: { id: integration.id },
        query: { pageSize: 100 },
        throwOnError: true,
      }),
    ),
  });

  const [choices, setChoices] = useState<Record<string, ChoiceState>>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');

  const compatibleProjects = useMemo(
    () => projects.filter((project) => isProjectCompatibleWithIntegration(project, integration)),
    [projects, integration],
  );

  const translatableResources = useMemo(
    () =>
      (resourcesQuery.data?.data ?? []).filter(
        (resource) => resource.status === 'tracked' && specsByKind.has(resource.kind),
      ),
    [resourcesQuery.data, specsByKind],
  );

  const existingLinksByResourceId = useMemo(() => {
    const map = new Map<
      string,
      { id: string; projectId: string; projectName: string; isIdentity: boolean }[]
    >();
    for (const link of linksQuery.data?.data ?? []) {
      for (const resLink of link.projectIntegrationResources) {
        const list = map.get(resLink.integrationResourceId) ?? [];
        list.push({
          id: resLink.id,
          projectId: link.projectId,
          projectName: link.project.name,
          isIdentity: resLink.isIdentity,
        });
        map.set(resLink.integrationResourceId, list);
      }
    }
    return map;
  }, [linksQuery.data]);

  if (specs.length === 0) return null;

  const defaultChoiceFor = (resourceId: string): ChoiceState => {
    const existing = existingLinksByResourceId.get(resourceId)?.[0];
    if (existing) return { target: existing.projectId, isIdentity: existing.isIdentity };
    return { target: NEW_PROJECT, isIdentity: true };
  };

  const choiceFor = (resourceId: string): ChoiceState =>
    choices[resourceId] ?? defaultChoiceFor(resourceId);

  const setChoice = (resourceId: string, next: ChoiceState) =>
    setChoices((prev) => {
      const updated: Record<string, ChoiceState> = { ...prev, [resourceId]: next };
      if (next.isIdentity && next.target !== NEW_PROJECT && next.target !== SKIP) {
        for (const other of translatableResources) {
          if (other.id === resourceId) continue;
          const otherChoice = prev[other.id] ?? defaultChoiceFor(other.id);
          if (otherChoice.target === next.target && otherChoice.isIdentity) {
            updated[other.id] = { ...otherChoice, isIdentity: false };
          }
        }
      }
      return updated;
    });

  const hasOtherIdentityForProject = (resourceId: string, projectId: string): boolean =>
    translatableResources.some((other) => {
      if (other.id === resourceId) return false;
      const otherChoice = choiceFor(other.id);
      return otherChoice.target === projectId && otherChoice.isIdentity;
    });

  const save = async () => {
    setPending(true);
    setNotice('');
    try {
      const toUnlinkIds: string[] = [];
      const newProjectItems: IntegrationCreateManyProjectIntegrationsData['body'] = [];
      const existingByProjectId = new Map<
        string,
        { integrationResourceId: string; isIdentity: boolean }[]
      >();

      for (const resource of translatableResources) {
        const existingLinks = existingLinksByResourceId.get(resource.id) ?? [];
        const current = defaultChoiceFor(resource.id);
        const selected = choiceFor(resource.id);
        const changed =
          existingLinks.length === 0 ||
          selected.target !== current.target ||
          selected.isIdentity !== current.isIdentity;
        if (!changed) continue;

        for (const link of existingLinks) {
          if (link.projectId !== selected.target) toUnlinkIds.push(link.id);
        }

        if (selected.target === SKIP) continue;

        if (selected.target === NEW_PROJECT) {
          const spec = specsByKind.get(resource.kind);
          const name = defaultProjectNameFor(resource, spec);
          newProjectItems.push({
            project: { name },
            resources: [{ integrationResourceId: resource.id, isIdentity: selected.isIdentity }],
          });
          continue;
        }

        const grouped = existingByProjectId.get(selected.target) ?? [];
        grouped.push({ integrationResourceId: resource.id, isIdentity: selected.isIdentity });
        existingByProjectId.set(selected.target, grouped);
      }

      for (const linkId of toUnlinkIds) {
        await apiMutation(projectIntegrationResourceDelete<true>)({ path: { id: linkId } });
      }

      const payload: IntegrationCreateManyProjectIntegrationsData['body'] = [
        ...newProjectItems,
        ...[...existingByProjectId.entries()].map(([projectId, resources]) => ({
          projectId,
          resources,
        })),
      ];

      if (payload.length > 0) {
        await apiMutation(integrationCreateManyProjectIntegrations<true>)({
          path: { id: integration.id },
          body: payload,
        });
      }

      await queryClient.invalidateQueries({ queryKey: linksQueryKey });
      setChoices({});
      setNotice('Projects saved.');
      onComplete?.();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to save projects.');
    } finally {
      setPending(false);
    }
  };

  const refresh = async () => {
    if (!onRefreshResources) return;
    setPending(true);
    setNotice('');
    try {
      await onRefreshResources();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: resourcesQueryKey }),
        queryClient.invalidateQueries({ queryKey: linksQueryKey }),
      ]);
      setNotice('Resources refreshed.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Failed to refresh resources.');
    } finally {
      setPending(false);
    }
  };

  const pluralHeading =
    specs.length === 1 ? `${specs[0]!.pluralLabel} as projects` : 'Set up projects';

  return (
    <section className="panel space-y-3">
      <div>
        <h2>{pluralHeading}</h2>
        <p className="muted">
          Create a project for each resource {integration.name} reaches, attach it to an existing
          project, or skip it.
        </p>
      </div>
      {(resourcesQuery.isLoading || linksQuery.isLoading) && (
        <p className="muted">Loading resources…</p>
      )}
      {!resourcesQuery.isLoading && translatableResources.length === 0 && (
        <p className="muted">No resources available yet.</p>
      )}
      {translatableResources.map((resource) => {
        const spec = specsByKind.get(resource.kind);
        const defaultName = defaultProjectNameFor(resource, spec);
        const selected = choiceFor(resource.id);
        const linked = existingLinksByResourceId.get(resource.id) ?? [];
        const selectId = `integration-project-target-${resource.id}`;
        return (
          <div key={resource.id} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor={selectId} className="block">
                {resource.name}
              </label>
              <Select
                id={selectId}
                value={selected.target}
                onChange={(target) =>
                  setChoice(resource.id, {
                    target,
                    isIdentity:
                      target === NEW_PROJECT
                        ? true
                        : target === SKIP
                          ? false
                          : !hasOtherIdentityForProject(resource.id, target),
                  })
                }
                options={[
                  { value: NEW_PROJECT, label: `New project: ${defaultName}` },
                  ...compatibleProjects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                  ...linked
                    .filter(
                      (item) =>
                        !compatibleProjects.some((project) => project.id === item.projectId),
                    )
                    .map((item) => ({ value: item.projectId, label: item.projectName })),
                  { value: SKIP, label: 'Skip' },
                ]}
              />
            </div>
            {selected.target !== SKIP && (
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={selected.isIdentity}
                  onChange={(event) =>
                    setChoice(resource.id, { ...selected, isIdentity: event.target.checked })
                  }
                />
                Project identity
              </label>
            )}
          </div>
        );
      })}
      {notice && <p role="status">{notice}</p>}
      <div className="flex gap-2">
        <Button
          disabled={pending || translatableResources.length === 0}
          onClick={() => void save()}
        >
          Save projects
        </Button>
        {onRefreshResources && (
          <Button variant="secondary" disabled={pending} onClick={() => void refresh()}>
            {refreshLabel}
          </Button>
        )}
        {onSkip && (
          <Button variant="ghost" disabled={pending} onClick={onSkip}>
            Skip for now
          </Button>
        )}
      </div>
    </section>
  );
};
