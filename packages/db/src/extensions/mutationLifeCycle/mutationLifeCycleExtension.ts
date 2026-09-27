/**
 * @atlas
 * @kind service
 * @partOf infrastructure:prisma
 * @uses none
 */
import { DbAction } from '@template/db/extensions/hookRegistry';
import { intercept, type MutationArgs } from '@template/db/extensions/mutationLifeCycle/intercept';
import { fetchExistingRecord, fetchExistingRecords } from '@template/db/extensions/mutationLifeCycle/loadPrevious';
import { claimPendingRegistration } from '@template/db/extensions/transactionRegistry';
import { Prisma } from '@template/db/generated/client/client';

const dataOf = (args: MutationArgs) => args.data;

export const mutationLifeCycleExtension = Prisma.defineExtension({
  name: 'mutationLifeCycle',
  query: {
    $allModels: {
      async findFirst(params) {
        claimPendingRegistration(params);
        return params.query(params.args);
      },

      create: intercept(DbAction.create, { invariantData: dataOf }),

      async createMany({ model }) {
        throw new Error(
          `createMany is not supported - use createManyAndReturn instead for ${model}. ` +
            'This ensures hooks (webhooks, cache, validation) work correctly.',
        );
      },

      createManyAndReturn: intercept(DbAction.createManyAndReturn, { invariantData: dataOf }),

      update: intercept(DbAction.update, { invariantData: dataOf, loadPrevious: fetchExistingRecord }),

      async updateMany({ model }) {
        throw new Error(
          `updateMany is not supported - use updateManyAndReturn instead for ${model}. ` +
            'This ensures hooks (webhooks, cache, validation) work correctly.',
        );
      },

      updateManyAndReturn: intercept(DbAction.updateManyAndReturn, {
        invariantData: dataOf,
        loadPrevious: fetchExistingRecords,
      }),

      upsert: intercept(DbAction.upsert, {
        invariantData: ({ create, update }) => [create, update],
        loadPrevious: fetchExistingRecord,
      }),

      delete: intercept(DbAction.delete, { loadPrevious: fetchExistingRecord }),

      deleteMany: intercept(DbAction.deleteMany, { loadPrevious: fetchExistingRecords }),
    },
  },
});
