/**
 * @atlas
 * @kind controller
 * @partOf feature:billing
 * @uses primitive:authz
 */
import { type AccessorName, db, type HydratedRecord, hydrate, toAccessor } from '@template/db';
import { check, rebacSchema } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { toBillingAccountResponse } from '#/modules/billingAccount/schemas/billingAccountSchemas';
import { billingResourceResolveRoute } from '#/modules/billingResource/routes/billingResourceResolve';
import {
  type BillingResolveTarget,
  resolveBillingAccount,
} from '#/modules/billingResource/services/resolveBillingAccount';

const fetchTargetRecord = async (target: BillingResolveTarget): Promise<HydratedRecord | null> => {
  switch (target.targetModel) {
    case 'User':
      return db.user.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'Organization':
      return db.organization.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'Space':
      return db.space.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'OrganizationUser':
      return db.organizationUser.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'SpaceUser':
      return db.spaceUser.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'Project':
      return db.project.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
    case 'ProjectIntegration':
      return db.projectIntegration.findFirst({
        where: { id: target.id, deletedAt: null },
      }) as Promise<HydratedRecord | null>;
  }
};

export const billingResourceResolveController = makeController(
  billingResourceResolveRoute,
  async (c, respond) => {
    const query = c.req.valid('query');
    const target: BillingResolveTarget = { targetModel: query.targetModel, id: query.id };
    const record = await fetchTargetRecord(target);
    if (!record) throw makeError({ status: 403, message: 'Access denied' });

    const permix = c.get('permix');
    const accessor = toAccessor(query.targetModel) as AccessorName;
    const hydratedTarget = await hydrate(accessor, record);
    if (!check(permix, rebacSchema, accessor, hydratedTarget, 'read')) {
      throw makeError({ status: 403, message: 'Access denied' });
    }

    const resolved = await resolveBillingAccount(target);
    if (!resolved) {
      return respond.ok({
        resolved: false,
        status: null,
        source: null,
        boundAt: null,
        billingResourceId: null,
        billingAccount: null,
      });
    }

    const hydratedAccount = await hydrate(
      'billingAccount',
      resolved.billingAccount as unknown as HydratedRecord,
    );
    const canReadAccount = check(permix, rebacSchema, 'billingAccount', hydratedAccount, 'read');

    let billingResourceId: string | null = null;
    if (resolved.billingResource) {
      const hydratedBinding = await hydrate(
        'billingResource',
        resolved.billingResource as unknown as HydratedRecord,
      );
      if (
        check(permix, rebacSchema, 'billingResource', hydratedBinding, 'read') ||
        check(permix, rebacSchema, 'billingResource', hydratedBinding, 'delete')
      ) {
        billingResourceId = resolved.billingResource.id;
      }
    }

    return respond.ok({
      resolved: true,
      status: resolved.billingAccount.status,
      source: resolved.source,
      boundAt: resolved.boundAt,
      billingResourceId,
      billingAccount: canReadAccount ? toBillingAccountResponse(resolved.billingAccount) : null,
    });
  },
);
