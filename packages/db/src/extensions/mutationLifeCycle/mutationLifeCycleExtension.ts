/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { DbAction } from '@template/db/extensions/hookRegistry';
import {
  fetchExistingRecord,
  fetchExistingRecords,
} from '@template/db/extensions/mutationLifeCycle/fetchExistingRecords';
import { makeMutationLifecycleInterceptor } from '@template/db/extensions/mutationLifeCycle/makeMutationLifecycleInterceptor';
import { claimPendingRegistration } from '@template/db/extensions/transactionRegistry';
import { Prisma } from '@template/db/generated/client/client';

export const mutationLifeCycleExtension = Prisma.defineExtension({
  name: 'mutationLifeCycle',
  query: {
    $allModels: {
      async findFirst(params) {
        claimPendingRegistration(params);
        return params.query(params.args);
      },

      create: makeMutationLifecycleInterceptor(DbAction.create),

      async createMany({ model }) {
        throw new Error(
          `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
            'This ensures hooks (webhooks, cache, validation) work correctly.',
        );
      },

      createManyAndReturn: makeMutationLifecycleInterceptor(DbAction.createManyAndReturn),

      update: makeMutationLifecycleInterceptor(DbAction.update, {
        loadPrevious: fetchExistingRecord,
      }),

      async updateMany({ model }) {
        throw new Error(
          `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
            'This ensures hooks (webhooks, cache, validation) work correctly.',
        );
      },

      updateManyAndReturn: makeMutationLifecycleInterceptor(DbAction.updateManyAndReturn, {
        loadPrevious: fetchExistingRecords,
      }),

      upsert: makeMutationLifecycleInterceptor(DbAction.upsert, {
        loadPrevious: fetchExistingRecord,
      }),

      delete: makeMutationLifecycleInterceptor(DbAction.delete, {
        loadPrevious: fetchExistingRecord,
      }),

      deleteMany: makeMutationLifecycleInterceptor(DbAction.deleteMany, {
        loadPrevious: fetchExistingRecords,
      }),
    },
  },
});
