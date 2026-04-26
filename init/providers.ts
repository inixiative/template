import type {
  BackendProvider,
  DatabaseProvider,
  EmailProvider,
  FrontendProvider,
  RedisProvider,
} from './utils/getProjectConfig';

export type ProviderOption<T extends string> = {
  value: T;
  label: string;
  implemented: boolean;
  note?: string;
};

export const FRONTEND_PROVIDERS: ProviderOption<FrontendProvider>[] = [
  { value: 'vercel', label: 'Vercel', implemented: true, note: 'Preview deployments per PR' },
  { value: 'cloudflare-pages', label: 'Cloudflare Pages', implemented: false, note: 'Free tier, fast global CDN' },
  { value: 'netlify', label: 'Netlify', implemented: false },
];

export const DATABASE_PROVIDERS: ProviderOption<DatabaseProvider>[] = [
  { value: 'planetscale', label: 'PlanetScale', implemented: true, note: 'Postgres (Metal), branching' },
  { value: 'railway-postgres', label: 'Railway Postgres', implemented: true, note: 'Bundled with Railway backend' },
  { value: 'neon', label: 'Neon', implemented: false, note: 'Serverless Postgres, generous free tier' },
  { value: 'supabase', label: 'Supabase', implemented: false, note: 'Postgres + auth + storage' },
];

export const BACKEND_PROVIDERS: ProviderOption<BackendProvider>[] = [
  { value: 'railway', label: 'Railway', implemented: true, note: 'Includes Redis + Postgres add-ons' },
  { value: 'fly', label: 'Fly.io', implemented: false, note: 'Free tier with persistent VMs' },
  { value: 'render', label: 'Render', implemented: false, note: 'Free web services with spin-down' },
];

export const REDIS_PROVIDERS: ProviderOption<RedisProvider>[] = [
  { value: 'railway', label: 'Railway Redis', implemented: true },
  { value: 'upstash', label: 'Upstash', implemented: false, note: 'Generous free tier, REST + native' },
];

export const EMAIL_PROVIDERS: ProviderOption<EmailProvider>[] = [
  { value: 'resend', label: 'Resend', implemented: true },
  { value: 'postmark', label: 'Postmark', implemented: false },
  { value: 'ses', label: 'AWS SES', implemented: false },
  { value: 'none', label: 'None (no outbound email)', implemented: true },
];
