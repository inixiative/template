import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  spyOn,
} from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import type { Artifact, Organization, Space, User } from '@template/db/generated/client/client';
import { WebhookModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createArtifact,
  createArtifactContainer,
  createArtifactPermission,
  createOrganization,
  createSpace,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import { registerArtifactAccessHook } from '#/hooks/artifactAccess/hook';
import { registerWebhookHook } from '#/hooks/webhooks/hook';
import * as enqueueModule from '#/jobs/enqueue';

type Enqueued = { subscriptionId: string; action: string; resourceId: string };

let enqueueSpy: Mock<typeof enqueueModule.enqueueJob>;

beforeEach(() => {
  enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({
    jobId: 'mock',
    name: 'sendWebhook',
  });
});

afterEach(() => {
  enqueueSpy.mockRestore();
});

const enqueued = () => enqueueSpy.mock.calls.map(([, payload]) => payload as Enqueued);
const heardBy = (subscriptionId: string) =>
  enqueued()
    .filter((payload) => payload.subscriptionId === subscriptionId)
    .map((payload) => payload.resourceId);

describe('webhook hook: Artifact audience', () => {
  let organization: Organization;
  let outsiderOrganization: Organization;
  let space: Space;
  let grantee: User;
  let organizationSub: { id: string };
  let granteeSub: { id: string };
  let spaceSub: { id: string };
  let outsiderSub: { id: string };

  const folder = async () =>
    (
      await createArtifact({
        kind: 'folder',
        ownerModel: 'Organization',
        organizationId: organization.id,
      })
    ).entity;

  beforeAll(async () => {
    registerArtifactAccessHook();
    registerWebhookHook();
    organization = (await createOrganization()).entity;
    outsiderOrganization = (await createOrganization()).entity;
    space = (await createSpace({}, { organization })).entity;
    grantee = (await createUser()).entity;
    const subscribe = async (owner: Record<string, string>) =>
      (await createWebhookSubscription({ ...owner, model: WebhookModel.Artifact })).entity;
    organizationSub = await subscribe({
      ownerModel: 'Organization',
      organizationId: organization.id,
    });
    outsiderSub = await subscribe({
      ownerModel: 'Organization',
      organizationId: outsiderOrganization.id,
    });
    granteeSub = await subscribe({ ownerModel: 'User', userId: grantee.id });
    spaceSub = await subscribe({ ownerModel: 'Space', spaceId: space.id });
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('a grant fires an Artifact event to the owner and the grantee, never to an unrelated party', async () => {
    const artifact = await folder();
    enqueueSpy.mockClear();
    await createArtifactPermission({
      artifactId: artifact.id,
      granteeModel: 'User',
      granteeUserId: grantee.id,
      role: 'viewer',
    });
    expect(heardBy(organizationSub.id)).toEqual([artifact.id]);
    expect(heardBy(granteeSub.id)).toEqual([artifact.id]);
    expect(heardBy(outsiderSub.id)).toEqual([]);
    expect(heardBy(spaceSub.id)).toEqual([]);
  });

  it('a revoked grantee still hears the revocation', async () => {
    const artifact = await folder();
    const { entity: permission } = await createArtifactPermission({
      artifactId: artifact.id,
      granteeModel: 'User',
      granteeUserId: grantee.id,
      role: 'viewer',
    });
    enqueueSpy.mockClear();
    await db.artifactPermission.update({
      where: { id: permission.id },
      data: { deletedAt: new Date() },
    });
    expect(heardBy(granteeSub.id)).toEqual([artifact.id]);
    expect(heardBy(organizationSub.id)).toEqual([artifact.id]);
  });

  it('an edge fires for both ends, each to its own audience: a private member is not the container audience', async () => {
    const container = await folder();
    await createArtifactPermission({
      artifactId: container.id,
      granteeModel: 'Space',
      granteeSpaceId: space.id,
      role: 'viewer',
    });
    const member = await folder();
    enqueueSpy.mockClear();
    await createArtifactContainer({ artifactId: member.id, containerArtifactId: container.id });
    expect(heardBy(spaceSub.id)).toEqual([container.id]);
    expect(heardBy(organizationSub.id).sort()).toEqual([container.id, member.id].sort());
    expect(heardBy(outsiderSub.id)).toEqual([]);
  });

  it('an inherit artifact reaches the parties its containers grant', async () => {
    const container = await folder();
    await createArtifactPermission({
      artifactId: container.id,
      granteeModel: 'User',
      granteeUserId: grantee.id,
      role: 'viewer',
    });
    const member: Artifact = await folder();
    await createArtifactContainer({ artifactId: member.id, containerArtifactId: container.id });
    enqueueSpy.mockClear();
    await db.artifact.update({ where: { id: member.id }, data: { access: 'inherit' } });
    expect(heardBy(granteeSub.id)).toEqual([member.id]);
  });
});
