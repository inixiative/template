import { makeAdapterRouter } from '@template/shared/adapter';
import { createS3Client } from '#/lib/storage/client/s3';
import type { StorageClient } from '#/lib/storage/types';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

const s3 = createS3Client({
  endpoint: required('STORAGE_ENDPOINT'),
  region: required('STORAGE_REGION'),
  accessKeyId: required('STORAGE_ACCESS_KEY_ID'),
  secretAccessKey: required('STORAGE_SECRET_ACCESS_KEY'),
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  buckets: {
    system: required('STORAGE_BUCKET_SYSTEM'),
    user: required('STORAGE_BUCKET_USER'),
  },
});

export const storage = makeAdapterRouter<StorageClient>({
  default: s3,
});

export type {
  Bucket,
  CopyObjectInput,
  DeleteObjectInput,
  HeadObjectInput,
  HeadObjectResult,
  PresignGetInput,
  PresignGetResult,
  PresignPostInput,
  PresignPostResult,
  StorageClient,
  TagObjectInput,
} from '#/lib/storage/types';
