import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { bouncerProgressSummaries } from '../tasks/bouncerSteps';
import {
  cloudflarePagesLiveActions,
  cloudflarePagesProgressSummaries,
} from '../tasks/cloudflarePagesSteps';
import { infisicalProgressSummaries } from '../tasks/infisicalSteps';
import { planetScaleProgressSummaries } from '../tasks/planetscaleSteps';
import { railwayBucketsProgressSummaries } from '../tasks/railwayBucketsSteps';
import { railwayPostgresProgressSummaries } from '../tasks/railwayPostgresSteps';
import { railwayProgressSummaries } from '../tasks/railwaySteps';
import { resendProgressSummaries } from '../tasks/resendSteps';
import { vercelProgressSummaries } from '../tasks/vercelSteps';
import { useConfig } from '../utils/configState';
import type { ProjectConfig } from '../utils/fetchProjectConfig';
import { prompt } from '../utils/prompts';

type MenuItem = {
  label: string;
  value: string;
  status: 'pending' | 'incomplete' | 'completed';
  progressDetails?: string[];
};

type MainMenuProps = {
  onSelectTask: (taskId: string) => void;
};

type ProgressSummary = {
  label: string;
  completedCount: number;
  totalCount: number;
};

const projectConfigMenuStatus = (config: ProjectConfig): MenuItem['status'] => {
  // Check if all project config steps are complete
  const { progress } = config.project;
  const allComplete = Object.values(progress).every((v) => v === true);
  return allComplete ? 'completed' : 'pending';
};

const statusFromSummaries = (
  progress: Record<string, boolean>,
  summaries: readonly ProgressSummary[],
  error?: string,
): { status: MenuItem['status']; details: string[] } => {
  const completed = Object.values(progress).filter((value) => value === true).length;
  const total = Object.keys(progress).length;
  const details = summaries
    .filter((summary) => summary.completedCount > 0)
    .map((summary) => summary.label);

  if (error) {
    details.push(`Error: ${error}`);
  }

  if (completed === 0) return { status: 'pending', details: [] };
  if (completed < total) return { status: 'incomplete', details };
  return { status: 'completed', details };
};

const infisicalMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.infisical.progress,
    infisicalProgressSummaries(config),
    config.infisical.error,
  );
};

const planetScaleMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.planetscale.progress,
    planetScaleProgressSummaries(config),
    config.planetscale.error,
  );
};

const railwayMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.railway.progress,
    railwayProgressSummaries(config),
    config.railway.error,
  );
};

const railwayPostgresMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  // Skipped groups don't count toward "is the section complete?" — derive a
  // synthetic progress map containing only the actions in non-skipped groups.
  const summaries = railwayPostgresProgressSummaries(config);
  const _liveActions = new Set<string>();
  for (const summary of summaries) {
    if (summary.skipped) continue;
    // Walk the original groups to recover which actions belong to each
    // non-skipped summary. Order is preserved between groups + summaries.
  }
  const filteredProgress: Record<string, boolean> = {};
  const stagingEnabled = config.features.staging.enabled;
  filteredProgress.ensureProdPostgresService =
    config.railwayPostgres.progress.ensureProdPostgresService;
  filteredProgress.storeProdPostgresUrl = config.railwayPostgres.progress.storeProdPostgresUrl;
  if (stagingEnabled) {
    filteredProgress.ensureStagingPostgresService =
      config.railwayPostgres.progress.ensureStagingPostgresService;
    filteredProgress.storeStagingPostgresUrl =
      config.railwayPostgres.progress.storeStagingPostgresUrl;
  }
  // Only count summaries that are NOT skipped against completion total.
  const liveSummaries = summaries.filter((s) => !s.skipped);
  return statusFromSummaries(filteredProgress, liveSummaries, config.railwayPostgres.error);
};

const railwayBucketsMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  const summaries = railwayBucketsProgressSummaries(config);
  const stagingEnabled = config.features.staging.enabled;
  const filteredProgress: Record<string, boolean> = {};
  filteredProgress.ensureProdSystemBucket = config.railwayBuckets.progress.ensureProdSystemBucket;
  filteredProgress.ensureProdUserBucket = config.railwayBuckets.progress.ensureProdUserBucket;
  filteredProgress.storeProdCredentials = config.railwayBuckets.progress.storeProdCredentials;
  if (stagingEnabled) {
    filteredProgress.ensureStagingSystemBucket =
      config.railwayBuckets.progress.ensureStagingSystemBucket;
    filteredProgress.ensureStagingUserBucket =
      config.railwayBuckets.progress.ensureStagingUserBucket;
    filteredProgress.storeStagingCredentials =
      config.railwayBuckets.progress.storeStagingCredentials;
  }
  const liveSummaries = summaries.filter((s) => !s.skipped);
  return statusFromSummaries(filteredProgress, liveSummaries, config.railwayBuckets.error);
};

const vercelMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.vercel.progress,
    vercelProgressSummaries(config),
    config.vercel.error,
  );
};

const launchMenuStatus = (config: ProjectConfig): MenuItem['status'] => {
  return config.launched ? 'completed' : 'pending';
};

const resendMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.resend.progress,
    resendProgressSummaries(config),
    config.resend.error,
  );
};

const bouncerMenuStatus = (
  config: ProjectConfig,
): { status: MenuItem['status']; details: string[] } => {
  return statusFromSummaries(
    config.bouncer.progress,
    bouncerProgressSummaries(config),
    config.bouncer.error,
  );
};

const DEFAULT_ITEMS: MenuItem[] = [
  { label: '1. Project Configuration', value: 'project-config', status: 'pending' },
  { label: '2. Infisical Setup', value: 'infisical', status: 'pending' },
  { label: '3. PlanetScale Setup', value: 'planetscale', status: 'pending' },
  { label: '4. Railway Setup', value: 'railway', status: 'pending' },
  { label: '5. Vercel Setup', value: 'vercel', status: 'pending' },
  { label: '6. Resend Setup', value: 'resend', status: 'pending' },
  { label: '7. Bouncer Setup', value: 'bouncer', status: 'pending' },
  { label: '8. Optional Integrations', value: 'integrations', status: 'pending' },
  { label: '9. DNS Configuration', value: 'dns', status: 'pending' },
  { label: '10. Database Seeding', value: 'seeding', status: 'pending' },
  { label: '11. GitHub Actions Setup', value: 'github-actions', status: 'pending' },
  { label: '12. Launch', value: 'launch', status: 'pending' },
  { label: '13. Documentation Generation', value: 'documentation', status: 'pending' },
  { label: '14. Exit', value: 'exit', status: 'pending' },
];

export const MainMenu: React.FC<MainMenuProps> = ({ onSelectTask }) => {
  const { config } = useConfig();
  const [items, setItems] = useState<MenuItem[]>(DEFAULT_ITEMS);

  // Calculate initial index from items
  const initialIndex = useMemo(() => {
    const firstIncompleteIndex = items.findIndex((item) => item.status !== 'completed');
    return firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;
  }, [items]);

  useEffect(() => {
    if (!config) return;

    const updateItems = () => {
      const cfg = config;

      // Derive status from config
      const projectConfigStatus = projectConfigMenuStatus(cfg);
      const infisicalStatus = infisicalMenuStatus(cfg);
      const planetscaleStatus = planetScaleMenuStatus(cfg);
      const railwayStatus = railwayMenuStatus(cfg);
      const vercelStatus = vercelMenuStatus(cfg);
      const resendStatus = resendMenuStatus(cfg);
      const bouncerStatus = bouncerMenuStatus(cfg);
      const launchStatus = launchMenuStatus(cfg);

      // Provider/feature-aware menu — only show steps for providers actually selected.
      // Settings menu lets the user switch providers + toggle staging; choices marked
      // "coming soon" can't actually be selected so the visible-step set still maps
      // 1:1 onto implemented setup flows.
      const usePlanetScale = cfg.providers.database === 'planetscale';
      const useRailwayPostgres = cfg.providers.database === 'railway-postgres';
      const useVercel = cfg.providers.frontend === 'vercel';
      const useCloudflarePages = cfg.providers.frontend === 'cloudflare-pages';
      const useResend = cfg.providers.email === 'resend';

      const railwayPostgresStatus = railwayPostgresMenuStatus(cfg);
      const railwayBucketsStatus = railwayBucketsMenuStatus(cfg);

      const cloudflarePagesSummaries = cloudflarePagesProgressSummaries(cfg);
      const cloudflarePagesLive = cloudflarePagesSummaries.filter((s) => !s.skipped);
      // Filter the progress map down to actions in non-skipped groups so
      // disabled web/admin/staging steps don't drag the section's
      // completion total up forever.
      const liveCloudflarePagesActions = cloudflarePagesLiveActions(cfg);
      const cloudflarePagesProgress: Record<string, boolean> = Object.fromEntries(
        liveCloudflarePagesActions.map((a) => [a, cfg.cloudflarePages.progress[a] === true]),
      );
      const cloudflarePagesStatus = statusFromSummaries(
        cloudflarePagesProgress,
        cloudflarePagesLive,
        cfg.cloudflarePages.error,
      );

      const candidates: (MenuItem | null)[] = [
        {
          label: 'Monitoring (OTel + structured logs)',
          value: 'monitoring',
          status:
            cfg.monitoring?.configProjectName === cfg.project.name &&
            Object.values(cfg.monitoring.progress).filter(Boolean).length === 18
              ? 'completed'
              : cfg.monitoring
                ? 'incomplete'
                : 'pending',
        },
        {
          label: 'Settings',
          value: 'settings',
          status: 'pending',
          progressDetails: [
            cfg.features.staging.enabled ? 'staging on' : 'staging off',
            `frontend: ${cfg.providers.frontend}`,
            `database: ${cfg.providers.database}`,
            `backend: ${cfg.providers.backend}`,
          ],
        },
        { label: 'Project Configuration', value: 'project-config', status: projectConfigStatus },
        {
          label: 'Infisical Setup',
          value: 'infisical',
          status: infisicalStatus.status,
          progressDetails: infisicalStatus.details,
        },
        usePlanetScale
          ? {
              label: 'PlanetScale Setup',
              value: 'planetscale',
              status: planetscaleStatus.status,
              progressDetails: planetscaleStatus.details,
            }
          : null,
        {
          label: 'Railway Setup',
          value: 'railway',
          status: railwayStatus.status,
          progressDetails: railwayStatus.details,
        },
        useRailwayPostgres
          ? {
              label: 'Railway Postgres Setup',
              value: 'railway-postgres',
              status: railwayPostgresStatus.status,
              progressDetails: railwayPostgresStatus.details,
            }
          : null,
        {
          label: 'Railway Buckets Setup',
          value: 'railway-buckets',
          status: railwayBucketsStatus.status,
          progressDetails: railwayBucketsStatus.details,
        },
        useVercel
          ? {
              label: 'Vercel Setup',
              value: 'vercel',
              status: vercelStatus.status,
              progressDetails: vercelStatus.details,
            }
          : null,
        useCloudflarePages
          ? {
              label: 'Cloudflare Pages Setup',
              value: 'cloudflare-pages',
              status: cloudflarePagesStatus.status,
              progressDetails: cloudflarePagesStatus.details,
            }
          : null,
        useResend
          ? {
              label: 'Resend Setup',
              value: 'resend',
              status: resendStatus.status,
              progressDetails: resendStatus.details,
            }
          : null,
        useResend
          ? {
              label: 'Bouncer Setup',
              value: 'bouncer',
              status: bouncerStatus.status,
              progressDetails: bouncerStatus.details,
            }
          : null,
        // Tail items: not yet implemented or deliberately deferred. Tagged
        // (coming soon) so users know these are placeholders, not bugs.
        // Selecting any of them lands on app.tsx's "Coming soon..." fallback.
        { label: 'Optional Integrations (coming soon)', value: 'integrations', status: 'pending' },
        { label: 'DNS Configuration (coming soon)', value: 'dns', status: 'pending' },
        { label: 'Database Seeding (coming soon)', value: 'seeding', status: 'pending' },
        { label: 'GitHub Actions Setup (coming soon)', value: 'github-actions', status: 'pending' },
        { label: 'Launch (coming soon)', value: 'launch', status: launchStatus },
        {
          label: 'Documentation Generation (coming soon)',
          value: 'documentation',
          status: 'pending',
        },
        { label: 'Exit', value: 'exit', status: 'pending' },
      ];

      const updatedItems = candidates
        .filter((item): item is MenuItem => item !== null)
        .map((item, idx) => ({ ...item, label: `${idx + 1}. ${item.label}` }));

      setItems(updatedItems as MenuItem[]);
    };

    updateItems();
  }, [config]);

  const itemComponent = ({
    isSelected = false,
    label,
  }: {
    isSelected?: boolean;
    label: string;
  }) => {
    // Find the item to get its status
    const item = items.find((i) => i.label === label);
    const statusIcon =
      item?.status === 'completed' ? '✓' : item?.status === 'incomplete' ? '⋯' : ' ';
    const prefix = isSelected ? '❯ ' : '  ';

    return (
      <Text
        color={
          isSelected
            ? 'cyan'
            : item?.status === 'completed'
              ? 'green'
              : item?.status === 'incomplete'
                ? 'yellow'
                : undefined
        }
      >
        {prefix}
        {statusIcon} {label}
      </Text>
    );
  };

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Setup Tasks
        </Text>
      </Box>

      <SelectInput
        key={initialIndex}
        items={items}
        itemComponent={itemComponent}
        indicatorComponent={() => null}
        onSelect={(item) => onSelectTask(item.value)}
        initialIndex={initialIndex}
      />

      <Box marginTop={1}>
        <Text dimColor>{prompt(['navigate', 'select'])}</Text>
      </Box>
    </Box>
  );
};
