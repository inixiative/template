export const isTest = process.env.ENVIRONMENT === 'test';
export const isLocal = process.env.ENVIRONMENT === 'local';
export const isDev = process.env.ENVIRONMENT === 'develop';
export const isProd = process.env.ENVIRONMENT === 'production';
