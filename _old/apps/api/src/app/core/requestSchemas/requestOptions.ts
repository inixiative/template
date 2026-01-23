export interface RequestOptions {
  tags?: string[];
  params?: any;
  query?: any;
  body?: any;
  summary?: string;
  description?: string;
  authentication?: boolean;
  requireAuth?: boolean;
  sanitizeKeys?: string[];
  pagination?: boolean;
}

export const requestOptions = (): RequestOptions => ({
  tags: [],
  params: undefined,
  query: undefined,
  body: undefined,
  summary: undefined,
  description: undefined,
  authentication: true,
  sanitizeKeys: [],
  pagination: false
});