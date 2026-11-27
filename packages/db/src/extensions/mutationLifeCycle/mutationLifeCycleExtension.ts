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
import { makeBulkWriteCountInterceptor } from '@template/db/extensions/mutationLifeCycle/makeBulkWriteCountInterceptor';
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

      createMany: makeBulkWriteCountInterceptor(DbAction.createManyAndReturn),

      createManyAndReturn: makeMutationLifecycleInterceptor(DbAction.createManyAndReturn),

      update: makeMutationLifecycleInterceptor(DbAction.update, {
        fetchPreviousRecords: fetchExistingRecord,
      }),

      updateMany: makeBulkWriteCountInterceptor(DbAction.updateManyAndReturn),

      updateManyAndReturn: makeMutationLifecycleInterceptor(DbAction.updateManyAndReturn, {
        fetchPreviousRecords: fetchExistingRecords,
      }),

      upsert: makeMutationLifecycleInterceptor(DbAction.upsert, {
        fetchPreviousRecords: fetchExistingRecord,
      }),

      delete: makeMutationLifecycleInterceptor(DbAction.delete, {
        fetchPreviousRecords: fetchExistingRecord,
      }),

      deleteMany: makeMutationLifecycleInterceptor(DbAction.deleteMany, {
        fetchPreviousRecords: fetchExistingRecords,
      }),
    },
  },
});
