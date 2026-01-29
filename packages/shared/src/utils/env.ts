/**
 * Canonical environment names: local | test | dev | staging | sandbox | prod
 */
export type Environment = 'local' | 'test' | 'dev' | 'staging' | 'sandbox' | 'prod';

export const isTest = process.env.ENVIRONMENT === 'test';
export const isLocal = process.env.ENVIRONMENT === 'local';
export const isDev = process.env.ENVIRONMENT === 'dev';
export const isProd = process.env.ENVIRONMENT === 'prod';
