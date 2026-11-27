/**
 * @atlas
 * @kind page
 * @partOf feature:project, primitive:ui
 * @uses primitive:sdk, primitive:authz
 */
import { Icon } from '@iconify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { List, ListRow, SkeletonText } from '@template/ui/components';
import { Modal } from '@template/ui/components/layout/Modal';
import { Page } from '@template/ui/components/layout/Page';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@template/ui/components/primitives';
import { hydrateSettingTargetForPermissions } from '@template/ui/lib/hydrateRecordForPermissions';
import type { MyMembershipOwnership } from '@template/ui/lib/myMembership';
import {
  type ProjectCreateBody,
  type ProjectRecord,
  projectContextQueries,
} from '@template/ui/lib/projectContextQueries';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useMemo, useState } from 'react';

type CreateProjectModalProps = {
  open: boolean;
  scopeLabel: string;
  isPending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (body: ProjectCreateBody) => void;
};

const CreateProjectModal = ({
  open,
  scopeLabel,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: CreateProjectModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const trimmedDescription = description.trim();
    onSubmit({
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`New project (${scopeLabel})`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="create-project-name">Project name</Label>
          <Input
            id="create-project-name"
            type="text"
            required
            placeholder="e.g. Core API"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-project-description">Description</Label>
          <Input
            id="create-project-description"
            type="text"
            placeholder="Optional summary"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        {errorMessage ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || isPending}>
            {isPending ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

type ProjectOwnerSectionProps = {
  context: AuthenticatedContext;
  ownership?: MyMembershipOwnership;
  sectionKey: string;
  title: string;
  description: string;
  onOpenProject: (project: ProjectRecord) => void;
};

const ProjectOwnerSection = ({
  context,
  ownership,
  sectionKey,
  title,
  description,
  onOpenProject,
}: ProjectOwnerSectionProps) => {
  const queryClient = useQueryClient();
  const auth = useAppStore((state) => state.auth);
  const permissions = useAppStore((state) => state.permissions);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const queries = useMemo(() => projectContextQueries(context, ownership), [context, ownership]);
  const listQueryKey = queries.readManyQueryKey({ pageSize: 100 });
  const projectsQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: queries.readManyQueryFn,
  });

  const canCreate = useMemo(() => {
    const ownerModel = queries.owner.ownerModel;
    const syntheticCandidate: Record<string, unknown> = {
      id: '',
      ownerModel,
      userId:
        ownerModel === 'User' || ownerModel === 'OrganizationUser' || ownerModel === 'SpaceUser'
          ? (auth.user?.id ?? null)
          : null,
      organizationId:
        ownerModel === 'User'
          ? null
          : (context.organization?.id ?? context.space?.organizationId ?? null),
      spaceId:
        ownerModel === 'Space' || ownerModel === 'SpaceUser' ? (context.space?.id ?? null) : null,
    };
    const hydrated = hydrateSettingTargetForPermissions(
      'Project',
      syntheticCandidate,
      auth,
      context,
    );
    return permissions.check('project', hydrated, 'create');
  }, [queries.owner.ownerModel, auth, context, permissions]);

  const createMutation = useMutation({
    throwOnError: false,
    mutationFn: (body: ProjectCreateBody) => queries.create.mutationFn({ body }),
    onSuccess: () => {
      setCreateError(null);
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: listQueryKey });
    },
    onError: (err) => {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    },
  });

  const projects = projectsQuery.data?.data ?? [];

  return (
    <section data-testid={`projects-section-${sectionKey}`}>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {canCreate ? (
            <Button
              type="button"
              size="sm"
              aria-label={`New project in ${title}`}
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              <Icon icon="lucide:plus" className="mr-1.5 h-4 w-4" />
              New project
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <List
            items={projects}
            isLoading={projectsQuery.isLoading}
            emptyMessage="No projects yet."
            skeletonItem={
              <ListRow
                name={<SkeletonText width="12rem" />}
                secondary={<SkeletonText width="16rem" />}
                actions={<OpenProjectButton />}
              />
            }
            renderItem={(project) => (
              <ListRow
                key={project.id}
                name={project.name}
                secondary={project.description}
                actions={<OpenProjectButton onOpen={() => onOpenProject(project)} />}
              />
            )}
          />
        </CardContent>
      </Card>

      {isCreateOpen ? (
        <CreateProjectModal
          open={isCreateOpen}
          scopeLabel={title}
          isPending={createMutation.isPending}
          errorMessage={createError}
          onClose={() => setCreateOpen(false)}
          onSubmit={(body) => createMutation.mutate(body)}
        />
      ) : null}
    </section>
  );
};

const personalContext: AuthenticatedContext = { type: 'user' };

export type ProjectsPageProps = {
  onOpenProject?: (project: ProjectRecord) => void;
};

const OpenProjectButton = ({ onOpen }: { onOpen?: () => void }) => (
  <Button type="button" variant="outline" size="sm" onClick={onOpen}>
    Open
    <Icon icon="lucide:arrow-right" className="ml-1.5 h-4 w-4" />
  </Button>
);

export const ProjectsPage = ({ onOpenProject }: ProjectsPageProps = {}) => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const navigateKeepingSearchParams = useAppStore(
    (state) => state.navigation.navigateKeepingSearchParams,
  );
  const tenant = context.space ?? context.organization;
  const hasMembership = useAppStore((state) =>
    context.space
      ? Boolean(state.auth.spaceUsers?.[context.space.id])
      : context.organization
        ? Boolean(state.auth.organizationUsers?.[context.organization.id])
        : false,
  );

  const handleOpenProject = (project: ProjectRecord) => {
    if (onOpenProject) {
      onOpenProject(project);
      return;
    }
    navigateKeepingSearchParams(`/projects/${project.id}/settings`, 'context');
  };

  return (
    <Page
      title="Projects"
      description="Manage projects, their settings, and connected integrations"
    >
      {tenant ? (
        <div className="space-y-6">
          <ProjectOwnerSection
            context={personalContext}
            sectionKey="personal"
            title="Personal"
            description="Projects owned by your personal account."
            onOpenProject={handleOpenProject}
          />
          {hasMembership ? (
            <ProjectOwnerSection
              context={context}
              ownership={{ ownedByMyMembership: true }}
              sectionKey="member"
              title={`Yours in ${tenant.name}`}
              description={`Projects owned by you within ${tenant.name}.`}
              onOpenProject={handleOpenProject}
            />
          ) : null}
          <ProjectOwnerSection
            context={context}
            sectionKey="tenant"
            title={`${tenant.name}'s projects`}
            description={`Projects shared across ${tenant.name}.`}
            onOpenProject={handleOpenProject}
          />
        </div>
      ) : (
        <ProjectOwnerSection
          context={context}
          sectionKey="user"
          title="Personal"
          description="Projects owned by your personal account."
          onOpenProject={handleOpenProject}
        />
      )}
    </Page>
  );
};
