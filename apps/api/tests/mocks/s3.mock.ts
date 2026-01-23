/**
 * Mock S3 client for testing.
 *
 * Prevents real AWS calls and returns predictable URLs.
 */
export const createMockS3Client = () => {
  const uploads: Map<string, { contentType: string; metadata: Record<string, string> }> = new Map();

  return {
    send: async (command: any) => {
      const commandName = command.constructor?.name || 'UnknownCommand';

      if (commandName === 'PutObjectCommand') {
        const { Bucket, Key, ContentType, Metadata } = command.input;
        uploads.set(Key, { contentType: ContentType, metadata: Metadata || {} });
        return { ETag: `"mock-etag-${Date.now()}"` };
      }

      if (commandName === 'GetObjectCommand') {
        const { Key } = command.input;
        if (!uploads.has(Key)) {
          const error = new Error('NoSuchKey');
          (error as any).name = 'NoSuchKey';
          throw error;
        }
        return {
          Body: {
            transformToString: async () => 'mock-content',
            transformToByteArray: async () => new Uint8Array([]),
          },
        };
      }

      if (commandName === 'DeleteObjectCommand') {
        const { Key } = command.input;
        uploads.delete(Key);
        return {};
      }

      return {};
    },

    // Test helpers
    _uploads: uploads,
    _clear: () => uploads.clear(),
  };
};

export type MockS3Client = ReturnType<typeof createMockS3Client>;
