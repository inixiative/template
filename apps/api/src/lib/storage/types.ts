/**
 * @atlas
 * @kind type
 * @partOf infrastructure:storage
 */
export type Bucket = 'system' | 'user';

export type PresignPostInput = {
  bucket: Bucket;
  key: string;
  contentType: string;
  contentLengthRange: readonly [min: number, max: number];
  metadata?: Record<string, string>;
  expiresInSeconds?: number;
};

export type PresignPostResult = {
  url: string;
  fields: Record<string, string>;
  expiresAt: Date;
};

export type PresignGetInput = {
  bucket: Bucket;
  key: string;
  expiresInSeconds?: number;
};

export type PresignGetResult = {
  url: string;
  expiresAt: Date;
};

export type HeadObjectInput = {
  bucket: Bucket;
  key: string;
};

export type HeadObjectResult = {
  size: number;
  contentType: string;
  etag: string;
  metadata: Record<string, string>;
};

export type CopyObjectInput = {
  sourceBucket: Bucket;
  sourceKey: string;
  targetBucket: Bucket;
  targetKey: string;
};

export type DeleteObjectInput = {
  bucket: Bucket;
  key: string;
};

export type TagObjectInput = {
  bucket: Bucket;
  key: string;
  tags: Record<string, string>;
};

export type StorageClient = {
  presignPost: (input: PresignPostInput) => Promise<PresignPostResult>;
  presignGet: (input: PresignGetInput) => Promise<PresignGetResult>;
  headObject: (input: HeadObjectInput) => Promise<HeadObjectResult | null>;
  copyObject: (input: CopyObjectInput) => Promise<void>;
  deleteObject: (input: DeleteObjectInput) => Promise<void>;
  tagObject: (input: TagObjectInput) => Promise<void>;
};
