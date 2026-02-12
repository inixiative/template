import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { getS3Client } from '#/lib/clients/s3';
import type { AppEnv } from '#/types/appEnv';

// Max file sizes by MIME type (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024, // 10MB
  'image/png': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/svg+xml': 2 * 1024 * 1024, // 2MB
  'video/mp4': 100 * 1024 * 1024, // 100MB
  'video/webm': 100 * 1024 * 1024,
  'application/pdf': 20 * 1024 * 1024, // 20MB
};

const ALLOWED_CONTENT_TYPES = Object.keys(MAX_FILE_SIZES);
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Sanitize filename to prevent path traversal and special characters
 */
const sanitizeFileName = (fileName: string): string => {
  return (
    fileName
      .trim()
      .replace(/\.\./g, '')
      .replace(/[/\\]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 200) || 'file'
  );
};

export type PresignedUrlRequest = {
  fileName: string;
  contentType: string;
  folder?: string;
};

export type PresignedUrlResponse = {
  presignedUrl: string;
  fileUrl: string;
  expiresIn: number;
  key: string;
  maxSize: number;
};

/**
 * Generate a presigned URL for direct S3 upload.
 *
 * Flow:
 * 1. Client requests presigned URL with filename & contentType
 * 2. Server validates, generates S3 key with ownership metadata
 * 3. Client uploads directly to S3 using presigned URL (PUT)
 * 4. Client uses fileUrl (CDN) for subsequent access
 */
export const generatePresignedUrl = async (
  c: Context<AppEnv>,
  request: PresignedUrlRequest,
): Promise<PresignedUrlResponse> => {
  const user = c.get('user');

  if (!user) {
    throw makeError({ status: 401, message: 'Authentication required', requestId: c.get('requestId') });
  }

  const { fileName, contentType, folder } = request;

  // Validate content type
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw makeError({
      status: 400,
      message: `Invalid content type. Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      requestId: c.get('requestId'),
    });
  }

  // Sanitize inputs
  const safeFileName = sanitizeFileName(fileName);
  const safeFolder = folder ? sanitizeFileName(folder) : '';

  // Build S3 key: {userId}/{folder?}/{timestamp}-{filename}
  const timestamp = Date.now();
  const keyParts = [user.id];
  if (safeFolder) {
    keyParts.push(safeFolder);
  }
  keyParts.push(`${timestamp}-${safeFileName}`);
  const key = keyParts.join('/');

  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw makeError({ status: 500, message: 'S3 not configured', requestId: c.get('requestId') });
  }

  const maxSize = MAX_FILE_SIZES[contentType] || 10 * 1024 * 1024;

  // Create presigned URL with metadata
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: {
      'user-id': user.id,
      'uploaded-at': new Date().toISOString(),
    },
  });

  const s3Client = await getS3Client();
  const presignedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });

  // Build final CDN URL (or direct S3 URL if no CDN)
  const cdnUrl = process.env.CLOUDFRONT_URL;
  const fileUrl = cdnUrl ? `${cdnUrl}/${key}` : `https://${bucket}.s3.amazonaws.com/${key}`;

  return {
    presignedUrl,
    fileUrl,
    expiresIn: PRESIGNED_URL_EXPIRY,
    key,
    maxSize,
  };
};
