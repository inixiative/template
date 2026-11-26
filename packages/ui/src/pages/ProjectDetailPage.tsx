/**
 * @atlas
 * @kind page
 * @partOf feature:project, primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HydratedRecord } from '@template/db';
import {} from '@template/ui/components';
import { Page } from '@template/ui/components/layout/Page';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@template/ui/components/primitives';
import {
  ProjectIntegrationsSection,
  type ProjectIntegrationsSectionProps,
} from '@template/ui/components/projects/ProjectIntegrationsSection';
import { ResourceSettingsSection } from '@template/ui/components/settings/ResourceSettingsSection';
import { hydrateSettingTargetForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import {
  projectDeleteMutationFn,
  projectListQueryKeysForProject,
  projectReadQueryOptions,
  projectUpdateMutationFn,
} from '@template/ui/lib/projectContextQueries';
import { useAppStore } from '@template/ui/store';
import { useEffect, useMemo, useState } from 'react';

export type ProjectDetailView = 'settings' | 'integrations';

export type ProjectDetailPageProps = {
  projectId: string;
  view?: ProjectDetailView;
  renderProjectIntegrationResources?: ProjectIntegrationsSectionProps['renderProjectIntegrationResources'];
  onNavigateBack?: () => void;
  onSelectView?: (view: ProjectDetailView) => void;
};

export const ProjectDetailPage = ({
  projectId,
  view = 'settings',
  renderProjectIntegrationResources,
  onNavigateBack,
  onSelectView,
}: ProjectDetailPageProps) => {
  const queryClient = useQueryClient();
  const auth = useAppStore((state) => state.auth);
  const tenantContext = useAppStore((state) => state.tenant.context);
  const permissions = useAppStore((state) => state.permissions);
  const navigateKeepingSearchParams = useAppStore(
    (state) => state.navigation.navigateKeepingSearchParams,
  );

  const readOpts = useMemo(() => projectReadQueryOptions(projectId), [projectId]);
  const projectQuery = useQuery({ ...readOpts, throwOnError: false });
  const project = projectQuery.data?.data;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setName(project.name);
    setDescription(project.description ?? '');
  }, [project]);

  const hydratedProject = useMemo(() => {
    if (!project) return null;
    return hydrateSettingTargetForPermissions(
      'Project',
      project as unknown as Record<string, unknown>,
      auth,
      tenantContext,
    );
  }, [project, auth, tenantContext]);

  const canManageProject = Boolean(
    hydratedProject && permissions.check('project', hydratedProject, 'manage'),
  );
  const canDeleteProject = Boolean(
    hydratedProject && permissions.check('project', hydratedProject, 'delete'),
  );

  const handleBack = () => {
    if (onNavigateBack) {
      onNavigateBack();
      return;
    }
    navigateKeepingSearchParams('/projects', 'context');
  };

  const handleSelectView = (nextView: ProjectDetailView) => {
    if (onSelectView) {
      onSelectView(nextView);
      return;
    }
    navigateKeepingSearchParams(`/projects/${projectId}/${nextView}`, 'context');
  };

  const invalidateOwnerProjectLists = () => {
    if (!project) return;
    for (const queryKey of projectListQueryKeysForProject(project, auth)) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  const updateMutation = useMutation({
    throwOnError: false,
    mutationFn: () =>
      projectUpdateMutationFn({
        path: { id: projectId },
        body: {
          name: name.trim(),
          description: description.trim() || null,
        },
      }),
    onSuccess: () => {
      setErrorMessage(null);
      setStatusMessage('Project updated');
      void queryClient.invalidateQueries({ queryKey: readOpts.queryKey });
      invalidateOwnerProjectLists();
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    throwOnError: false,
    mutationFn: () => projectDeleteMutationFn({ path: { id: projectId } }),
    onSuccess: () => {
      invalidateOwnerProjectLists();
      handleBack();
      queryClient.removeQueries({ queryKey: readOpts.queryKey });
    },
    onError: (err) => {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete project');
    },
  });

  if (!projectQuery.isLoading && !project) {
    return (
      <Page
        title="Project not found"
        actions={
          <Button type="button" variant="outline" size="sm" onClick={handleBack}>
            <Icon icon="lucide:arrow-left" className="mr-1.5 h-4 w-4" />
            Back to projects
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          This project could not be loaded or you do not have permission to view it.
        </p>
      </Page>
    );
  }

  const isDirty = Boolean(
    project &&
      (name.trim() !== project.name ||
        (description.trim() || null) !== (project.description ?? null)),
  );

  return (
    <Page
      title={
        project ? (
          <span className="inline-flex items-center gap-2.5">
            <span>{project.name}</span>
            <Badge variant="outline" className="text-xs font-normal">
              {project.ownerModel}
            </Badge>
          </span>
        ) : (
          'Project'
        )
      }
      description={project?.description ?? undefined}
      actions={
        <Button type="button" variant="outline" size="sm" onClick={handleBack}>
          <Icon icon="lucide:arrow-left" className="mr-1.5 h-4 w-4" />
          Back to projects
        </Button>
      }
    >
      <nav aria-label="Project sections" className="flex items-center gap-2 border-b pb-3">
        <Button
          type="button"
          variant={view === 'settings' ? 'default' : 'ghost'}
          size="sm"
          aria-current={view === 'settings' ? 'page' : undefined}
          onClick={() => handleSelectView('settings')}
        >
          <Icon icon="lucide:sliders-horizontal" className="mr-1.5 h-4 w-4" />
          Settings
        </Button>
        <Button
          type="button"
          variant={view === 'integrations' ? 'default' : 'ghost'}
          size="sm"
          aria-current={view === 'integrations' ? 'page' : undefined}
          onClick={() => handleSelectView('integrations')}
        >
          <Icon icon="lucide:plug" className="mr-1.5 h-4 w-4" />
          Integrations
        </Button>
      </nav>

      {view === 'settings' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project details</CardTitle>
              <CardDescription>Update this project&apos;s name and description.</CardDescription>
            </CardHeader>
            <CardContent isPending={!project}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!name.trim() || !canManageProject) return;
                  updateMutation.mutate();
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="project-detail-name">Name</Label>
                  <Input
                    id="project-detail-name"
                    type="text"
                    value={name}
                    disabled={!canManageProject}
                    onChange={(event) => {
                      setStatusMessage(null);
                      setName(event.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="project-detail-description">Description</Label>
                  <Input
                    id="project-detail-description"
                    type="text"
                    value={description}
                    disabled={!canManageProject}
                    onChange={(event) => {
                      setStatusMessage(null);
                      setDescription(event.target.value);
                    }}
                  />
                </div>
                {errorMessage ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
                {statusMessage ? (
                  <p role="status" className="text-sm text-muted-foreground">
                    {statusMessage}
                  </p>
                ) : null}
                {canManageProject ? (
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!name.trim() || !isDirty || updateMutation.isPending}
                    >
                      {updateMutation.isPending ? 'Saving…' : 'Save details'}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You do not have permission to edit this project.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          {project ? (
            <ResourceSettingsSection
              target={{
                model: 'Project',
                id: project.id,
                record: project as unknown as HydratedRecord,
              }}
              category="general"
            />
          ) : null}

          {canDeleteProject ? (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Delete project</CardTitle>
                <CardDescription>
                  Soft-deletes this project, its settings, and its integration links.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  {deleteMutation.isPending ? 'Deleting…' : 'Delete project'}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : project ? (
        <ProjectIntegrationsSection
          project={project}
          renderProjectIntegrationResources={renderProjectIntegrationResources}
        />
      ) : null}
    </Page>
  );
};
