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

// Lazy-loaded client (only initialize when needed)
let __s3Client: Awaited<ReturnType<typeof createS3Client>> | null = null;

export const createS3Client = async () => {
  const { S3Client } = await import('@aws-sdk/client-s3');

  return new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
};

export const getS3Client = async () => {
  if (!__s3Client) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials not configured');
    }
    __s3Client = await createS3Client();
  }
  return __s3Client;
};

// Re-export types for convenience
export type { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
