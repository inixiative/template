/**
 * @atlas
 * @kind client
 * @partOf infrastructure:storage
 */
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
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

const DEFAULT_EXPIRES_SECONDS = 900;

export type S3StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  buckets: { system: string; user: string };
};

let __client: S3Client | null = null;

export const createS3Client = (config: S3StorageConfig): StorageClient => {
  __client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });
  const client = __client;

  const resolveBucket = (bucket: Bucket): string => config.buckets[bucket];

  const presignPost = async (input: PresignPostInput): Promise<PresignPostResult> => {
    const expires = input.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS;
    const metadataFields = Object.fromEntries(
      Object.entries(input.metadata ?? {}).map(([k, v]) => [`x-amz-meta-${k}`, v]),
    );
    const { url, fields } = await createPresignedPost(client, {
      Bucket: resolveBucket(input.bucket),
      Key: input.key,
      Conditions: [
        ['content-length-range', input.contentLengthRange[0], input.contentLengthRange[1]],
        ['eq', '$Content-Type', input.contentType],
      ],
      Fields: { 'Content-Type': input.contentType, ...metadataFields },
      Expires: expires,
    });
    return { url, fields, expiresAt: new Date(Date.now() + expires * 1000) };
  };

  const presignGet = async (input: PresignGetInput): Promise<PresignGetResult> => {
    const expires = input.expiresInSeconds ?? DEFAULT_EXPIRES_SECONDS;
    const command = new GetObjectCommand({
      Bucket: resolveBucket(input.bucket),
      Key: input.key,
    });
    const url = await getSignedUrl(client, command, { expiresIn: expires });
    return { url, expiresAt: new Date(Date.now() + expires * 1000) };
  };

  const headObject = async (input: HeadObjectInput): Promise<HeadObjectResult | null> => {
    try {
      const result = await client.send(
        new HeadObjectCommand({
          Bucket: resolveBucket(input.bucket),
          Key: input.key,
        }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
        etag: result.ETag ?? '',
        metadata: result.Metadata ?? {},
      };
    } catch (err) {
      if (err instanceof Error && (err.name === 'NotFound' || err.name === 'NoSuchKey')) return null;
      throw err;
    }
  };

  const copyObject = async (input: CopyObjectInput): Promise<void> => {
    await client.send(
      new CopyObjectCommand({
        Bucket: resolveBucket(input.targetBucket),
        Key: input.targetKey,
        CopySource: `${resolveBucket(input.sourceBucket)}/${input.sourceKey}`,
      }),
    );
  };

  const deleteObject = async (input: DeleteObjectInput): Promise<void> => {
    await client.send(
      new DeleteObjectCommand({
        Bucket: resolveBucket(input.bucket),
        Key: input.key,
      }),
    );
  };

  const tagObject = async (input: TagObjectInput): Promise<void> => {
    await client.send(
      new PutObjectTaggingCommand({
        Bucket: resolveBucket(input.bucket),
        Key: input.key,
        Tagging: {
          TagSet: Object.entries(input.tags).map(([Key, Value]) => ({ Key, Value })),
        },
      }),
    );
  };

  return { presignPost, presignGet, headObject, copyObject, deleteObject, tagObject };
};
