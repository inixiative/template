// Type declarations for optional dependencies
// These are optional deps that may not be installed

declare module '@aws-sdk/client-s3' {
  export class S3Client {
    constructor(config: any);
    send(command: any): Promise<any>;
  }
  export class PutObjectCommand {
    constructor(params: any);
  }
  export class GetObjectCommand {
    constructor(params: any);
  }
  export class DeleteObjectCommand {
    constructor(params: any);
  }
}

declare module '@aws-sdk/s3-request-presigner' {
  export function getSignedUrl(client: any, command: any, options?: any): Promise<string>;
}
