import { beforeAll, describe, expect, it } from 'bun:test';
import { createS3Client } from '#/lib/storage/client/s3';
import type { StorageClient } from '#/lib/storage/types';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

describe('s3 storage adapter', () => {
  let storage: StorageClient;
  let testPrefix: string;

  beforeAll(() => {
    storage = createS3Client({
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
    testPrefix = `__test/${crypto.randomUUID()}`;
  });

  const uploadObject = async (key: string, body: string, contentType = 'text/plain') => {
    const { url, fields } = await storage.presignPost({
      bucket: 'user',
      key,
      contentType,
      contentLengthRange: [1, 4096],
    });
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.append(k, v);
    formData.append('file', new Blob([body], { type: contentType }));
    const resp = await fetch(url, { method: 'POST', body: formData });
    if (resp.status !== 204) throw new Error(`Upload failed with ${resp.status}: ${await resp.text()}`);
  };

  it('full upload → head → download → delete flow', async () => {
    const key = `${testPrefix}/hello.txt`;
    const content = 'hello world';

    await uploadObject(key, content);

    const head = await storage.headObject({ bucket: 'user', key });
    expect(head).not.toBeNull();
    expect(head?.size).toBe(content.length);
    expect(head?.contentType).toBe('text/plain');

    const { url: getUrl } = await storage.presignGet({ bucket: 'user', key });
    const downloadResp = await fetch(getUrl);
    expect(downloadResp.status).toBe(200);
    expect(await downloadResp.text()).toBe(content);

    await storage.deleteObject({ bucket: 'user', key });
    expect(await storage.headObject({ bucket: 'user', key })).toBeNull();
  });

  it('headObject returns null for missing key', async () => {
    const result = await storage.headObject({ bucket: 'user', key: `${testPrefix}/missing.txt` });
    expect(result).toBeNull();
  });

  it('copyObject duplicates bytes; both source and target readable', async () => {
    const src = `${testPrefix}/src.txt`;
    const dst = `${testPrefix}/dst.txt`;
    const content = 'copy me';

    await uploadObject(src, content);
    await storage.copyObject({ sourceBucket: 'user', sourceKey: src, targetBucket: 'user', targetKey: dst });

    expect((await storage.headObject({ bucket: 'user', key: src }))?.size).toBe(content.length);
    expect((await storage.headObject({ bucket: 'user', key: dst }))?.size).toBe(content.length);

    await storage.deleteObject({ bucket: 'user', key: src });
    await storage.deleteObject({ bucket: 'user', key: dst });
  });

  it('tagObject does not throw on existing object', async () => {
    const key = `${testPrefix}/tagged.txt`;
    await uploadObject(key, 'tag me');

    await storage.tagObject({ bucket: 'user', key, tags: { uploadedBy: 'test', purpose: 'smoke' } });

    await storage.deleteObject({ bucket: 'user', key });
  });

  it('presignPost rejects size outside contentLengthRange', async () => {
    const key = `${testPrefix}/oversized.txt`;
    const { url, fields } = await storage.presignPost({
      bucket: 'user',
      key,
      contentType: 'text/plain',
      contentLengthRange: [1, 10],
    });
    const formData = new FormData();
    for (const [k, v] of Object.entries(fields)) formData.append(k, v);
    formData.append('file', new Blob(['x'.repeat(100)], { type: 'text/plain' }));
    const resp = await fetch(url, { method: 'POST', body: formData });
    expect(resp.status).toBeGreaterThanOrEqual(400);
  });
});
