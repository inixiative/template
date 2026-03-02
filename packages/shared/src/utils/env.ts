/**
 * Canonical environment names: local | test | pr | staging | prod
 */
export type Environment = 'local' | 'test' | 'pr' | 'staging' | 'prod';

export const isTest = process.env.ENVIRONMENT === 'test';
export const isLocal = process.env.ENVIRONMENT === 'local';
export const isPR = process.env.ENVIRONMENT === 'pr';
export const isStaging = process.env.ENVIRONMENT === 'staging';
export const isProd = process.env.ENVIRONMENT === 'prod';
