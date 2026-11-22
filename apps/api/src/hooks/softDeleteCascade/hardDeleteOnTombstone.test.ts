import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { TokenOwnerModel } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFlow,
  createIntegration,
  createOrganization,
  createToken,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import {
  closeOnParentDeleteViolations,
  hardDeleteOnTombstoneViolations,
  skipReviveViolations,
  unclassifiedChildViolations,
} from '#/hooks/softDeleteCascade/validateDeleteBehavior';

const tokenStamp = async (id: string) =>
  (await db.withDeleted(() => db.token.findUniqueOrThrow({ where: { id } }))).deletedAt;

const tombstoneUser = (id: string) =>
  db.user.update({ where: { id }, data: { deletedAt: new Date() } });
const tombstoneOrg = (id: string) =>
  db.organization.update({ where: { id }, data: { deletedAt: new Date() } });
const tombstoneIntegration = (id: string) =>
  db.integration.update({ where: { id }, data: { deletedAt: new Date() } });

describe('hardDeleteOnTombstone — rows that cannot outlive their parent', () => {
  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('tombstones a tombstoned user’s tokens, keeping their rows (Aron, 2026-11-02)', async () => {
    const { entity: user } = await createUser();
    const { entity: token } = await createToken({ ownerModel: 'User' }, { user });

    await tombstoneUser(user.id);

    expect(await db.token.findUnique({ where: { id: token.id } })).toBeNull();
    expect(await tokenStamp(token.id)).not.toBeNull();
  });

  it('hard-deletes a tombstoned user’s webhook subscriptions', async () => {
    const { entity: user, context } = await createUser();
    const { entity: subscription } = await createWebhookSubscription(
      { resourceModel: 'CustomerRelationship', ownerModel: 'User' },
      context,
    );

    await tombstoneUser(user.id);

    expect(await db.webhookSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
  });

  it('hard-deletes a tombstoned user’s flows', async () => {
    const { entity: user } = await createUser();
    const { entity: flow } = await createFlow({}, { user });

    await tombstoneUser(user.id);

    expect(await db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
  });

  it('tombstones an organization’s tokens when the organization is tombstoned', async () => {
    const { entity: org } = await createOrganization();
    const { entity: token } = await createToken(
      { ownerModel: TokenOwnerModel.Organization },
      { organization: org },
    );

    await tombstoneOrg(org.id);

    expect(await tokenStamp(token.id)).not.toBeNull();
  });

  it('tombstones a tombstoned integration’s tokens and hard-deletes its webhook subscriptions', async () => {
    const { entity: user, context } = await createUser();
    const { entity: integration } = await createIntegration({
      ownerModel: 'User',
      userId: user.id,
    });
    const { entity: token } = await createToken({ ownerModel: 'Integration' }, { integration });
    const { entity: subscription } = await createWebhookSubscription(
      { resourceModel: 'CustomerRelationship', ownerModel: 'User', integrationId: integration.id },
      context,
    );

    await tombstoneIntegration(integration.id);

    expect(await tokenStamp(token.id)).not.toBeNull();
    expect(await db.webhookSubscription.findUnique({ where: { id: subscription.id } })).toBeNull();
  });
});

describe('validateDeleteBehavior', () => {
  it('finds the registry consistent with the schema', () => {
    expect(hardDeleteOnTombstoneViolations()).toEqual([]);
  });

  it('catches a required child left behind by a hard delete', () => {
    expect(hardDeleteOnTombstoneViolations(['WebhookSubscription']).join('\n')).toContain(
      'WebhookEvent.webhookSubscriptionId is a required reference to WebhookSubscription',
    );
  });

  it('refuses a model that carries deletedAt', () => {
    expect(hardDeleteOnTombstoneViolations(['Account']).join('\n')).toContain(
      'has a deletedAt column',
    );
  });

  it('refuses a model that is also registered as soft-delete', () => {
    expect(hardDeleteOnTombstoneViolations(['User']).join('\n')).toContain(
      'both hard-delete-on-tombstone and soft-delete',
    );
  });

  it('refuses a model that is not in the schema', () => {
    expect(hardDeleteOnTombstoneViolations(['NotAModel']).join('\n')).toContain(
      'is not a model in the schema',
    );
  });
});

describe('SKIP_REVIVE validation', () => {
  it('finds the registry consistent with the schema', () => {
    expect(skipReviveViolations()).toEqual([]);
  });

  it('accepts a soft-deleted model', () => {
    expect(skipReviveViolations(['Tag'])).toEqual([]);
  });

  it('refuses a model that is hard-deleted on tombstone', () => {
    expect(skipReviveViolations(['Session']).join('\n')).toContain(
      'both SKIP_REVIVE and HARD_DELETE_ON_TOMBSTONE',
    );
  });

  it('refuses a model with no deletedAt column', () => {
    expect(skipReviveViolations(['AuditLog']).join('\n')).toContain('has no deletedAt column');
  });

  it('refuses a model that is not in the schema', () => {
    expect(skipReviveViolations(['NotAModel']).join('\n')).toContain(
      'is not a model in the schema',
    );
  });
});

describe('CLOSE_ON_PARENT_DELETE validation', () => {
  it('finds every closed model kept by soft-delete parents only', () => {
    expect(closeOnParentDeleteViolations()).toEqual([]);
  });

  it('refuses a model a hard-deletable parent would take along', () => {
    expect(closeOnParentDeleteViolations(['WebhookEvent']).join('\n')).toContain(
      'its parent WebhookSubscription can be hard-deleted',
    );
  });

  it('refuses a model that is not in the schema', () => {
    expect(closeOnParentDeleteViolations(['NotAModel']).join('\n')).toContain(
      'is not a model in the schema',
    );
  });
});

// why: history and log rows Aron has not yet classified (2026-11-19); the list only shrinks.
const awaitingClassification = [
  'AuditLog.actorSpoofUserId belongs to User',
  'AuditLog.actorUserId belongs to User',
  'AuditLog.contextUserId belongs to User',
  'AuditLog.subjectUserId belongs to User',
  'CommunicationLog.recipientUserId belongs to User',
  'CommunicationLog.senderUserId belongs to User',
  'CronJob.createdById belongs to User',
  'AuditLog.contextOrganizationId belongs to Organization',
  'AuditLog.subjectOrganizationId belongs to Organization',
  'CommunicationLog.senderOrganizationId belongs to Organization',
  'AuditLog.subjectOrganizationId+subjectUserId belongs to OrganizationUser',
  'CommunicationLog.senderOrganizationId+senderUserId belongs to OrganizationUser',
  'AuditLog.contextSpaceId belongs to Space',
  'AuditLog.subjectSpaceId belongs to Space',
  'CommunicationLog.senderOrganizationId+senderSpaceId belongs to Space',
  'AuditLog.subjectOrganizationId+subjectSpaceId+subjectUserId belongs to SpaceUser',
  'CommunicationLog.senderOrganizationId+senderSpaceId+senderUserId belongs to SpaceUser',
  'AuditLog.subjectAuthProviderId belongs to AuthProvider',
  'AuditLog.sourceInquiryId belongs to Inquiry',
  'AuditLog.subjectInquiryId belongs to Inquiry',
  'AuditLog.subjectCustomerRelationshipId belongs to CustomerRelationship',
  'AuditLog.subjectEmailTemplateId belongs to EmailTemplate',
  'CommunicationLog.emailTemplateId belongs to EmailTemplate',
  'AuditLog.subjectEmailComponentId belongs to EmailComponent',
  'CommunicationComponentVersion.emailComponentId belongs to EmailComponent',
  'AppEvent.integrationId belongs to Integration',
  'AuditLog.actorIntegrationId belongs to Integration',
  'AuditLog.subjectIntegrationId belongs to Integration',
  'AuditLog.subjectSegmentId belongs to Segment',
  'AuditLog.actorTokenId belongs to Token',
  'AuditLog.subjectTokenId belongs to Token',
  'AuditLog.subjectEntitlementId belongs to Entitlement',
  'AuditLog.subjectProjectId belongs to Project',
  'AuditLog.subjectIntegrationResourceId belongs to IntegrationResource',
  'AuditLog.subjectProjectIntegrationResourceId belongs to ProjectIntegrationResource',
  'CommunicationLog.recipientContactId belongs to Contact',
];

const unclassifiedRelation = (violation: string) => violation.split(', which is soft-deleted')[0];

describe('every child of a soft-deleted parent is classified', () => {
  it('finds no child the cascade would leave live under a tombstoned parent beyond those awaiting classification', () => {
    expect(unclassifiedChildViolations().map(unclassifiedRelation)).toEqual(awaitingClassification);
  });

  it('accepts a child that is hard-deleted, closed or tombstoned with its parent', () => {
    expect(
      unclassifiedChildViolations(['TagCategory', 'WebhookSubscription', 'SegmentMember']),
    ).toEqual([]);
  });

  it('names a child with no deletedAt and no policy', () => {
    expect(unclassifiedChildViolations(['Segment']).join('\n')).toContain(
      'AuditLog.subjectSegmentId belongs to Segment, which is soft-deleted',
    );
  });
});
