/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import {
  FilePermissionGranteeModel,
  FilePermissionTargetModel,
  Role,
} from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const filePermissionFactory = createFactory('FilePermission', {
  defaults: () => ({
    targetModel: FilePermissionTargetModel.File,
    granteeModel: FilePermissionGranteeModel.User,
    role: Role.viewer,
  }),
  dependencies: {
    file: { modelName: 'File', foreignKey: { id: 'fileId' }, required: false },
    folder: { modelName: 'Folder', foreignKey: { id: 'folderId' }, required: false },
    granteeUser: { modelName: 'User', foreignKey: { id: 'granteeUserId' }, required: false },
    granteeOrganization: { modelName: 'Organization', foreignKey: { id: 'granteeOrganizationId' }, required: false },
    granteeSpace: { modelName: 'Space', foreignKey: { id: 'granteeSpaceId' }, required: false },
    granteeCustomerRef: { modelName: 'CustomerRef', foreignKey: { id: 'granteeCustomerRefId' }, required: false },
  },
});

export const buildFilePermission = filePermissionFactory.build;
export const createFilePermission = filePermissionFactory.create;
export const upsertFilePermission = filePermissionFactory.upsert;
