/**
 * AWS S3 Client
 *
 * Used for storing documents (legal contracts, KYC documents, asset reports).
 *
 * Required environment variables:
 * - AWS_REGION
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - S3_BUCKET_NAME
 */

import { env } from '#/config/env';

// Lazy-loaded client (only initialize when needed)
let _s3Client: Awaited<ReturnType<typeof createS3Client>> | null = null;

export async function createS3Client() {
  const { S3Client } = await import('@aws-sdk/client-s3');

  return new S3Client({
    region: env.AWS_REGION,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function getS3Client() {
  if (!_s3Client) {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }
    _s3Client = await createS3Client();
  }
  return _s3Client;
}

// Re-export types for convenience
export type { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
