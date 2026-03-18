// Type declarations for optional dependencies
// These are optional deps that may not be installed

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
    constructor(config: any);
    // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
    send(command: any): Promise<any>;
  }
  export class PutObjectCommand {
    // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
    constructor(params: any);
  }
  export class GetObjectCommand {
    // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
    constructor(params: any);
  }
  export class DeleteObjectCommand {
    // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
    constructor(params: any);
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  // biome-ignore lint/suspicious/noExplicitAny: stub declaration for optional dep
  export function getSignedUrl(client: any, command: any, options?: any): Promise<string>;
}
