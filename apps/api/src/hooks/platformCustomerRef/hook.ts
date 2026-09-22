import { DbAction, HookTiming, registerDbHook } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';
import { emitAppEvent } from '#/appEvents/emit';
import { provisionPlatformCustomerRef } from '#/modules/customerRef/services/provisionPlatformCustomerRef';

const PLATFORM_CUSTOMER_MODELS: CustomerModel[] = ['User', 'Organization', 'Space'];

export const registerPlatformCustomerRefHook = () => {
  registerDbHook(
    'platformCustomerRef:create',
    PLATFORM_CUSTOMER_MODELS,
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ model, result }) => {
      for (const row of castArray(result) as { id: string }[]) {
        const { customerRef, outcome } = await provisionPlatformCustomerRef(model as CustomerModel, row.id);
        if (outcome !== 'present') await emitAppEvent('customerRef.created', { customerRef });
      }
    },
  );
};
