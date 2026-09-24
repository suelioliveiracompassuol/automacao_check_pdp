'use client';

import { useState } from 'react';
import type { MonitoringReport, Platform, ReportIndexEntry } from '@/lib/types';
import { EvolutionSection } from './evolution-section';
import { ErrorMatrixSection } from './error-matrix-section';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaAndroid } from 'react-icons/fa';
import type { ReactNode } from 'react';

export interface PlatformBreakdownData {
  platform: Platform;
  label: string;
  evolutionData: ReportIndexEntry[];
  reports: MonitoringReport[];
}

interface PlatformBreakdownSectionProps {
  /** Platforms with at least one run, in display order (Web first). Platforms with zero runs
   * (e.g. iOS before its first execution) are omitted upstream, so no empty tab is shown. */
  data: PlatformBreakdownData[];
}

const PLATFORM_ICON: Record<Platform, ReactNode> = {
  web: '🌐',
  android: <FaAndroid />,
  ios: '🍏',
};

/** Evolução Histórica + Matriz de Erros for one platform at a time, switched via tabs (Web
 * first) instead of stacking a full copy of both sections per platform down the page. */
export function PlatformBreakdownSection({ data }: PlatformBreakdownSectionProps) {
  const [activePlatform, setActivePlatform] = useState(data[0]?.platform);
  const active = data.find((d) => d.platform === activePlatform) ?? data[0];

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-8">
      {data.length > 1 && (
        <Tabs
          value={active.platform}
          onValueChange={(value) => setActivePlatform(value as Platform)}
        >
          <TabsList aria-label="Selecionar plataforma">
            {data.map((d) => (
              <TabsTrigger
                key={d.platform}
                value={d.platform}
                isActive={active.platform === d.platform}
              >
                <span aria-hidden="true">{PLATFORM_ICON[d.platform]}</span>
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <EvolutionSection evolutionData={active.evolutionData} />
      <ErrorMatrixSection reports={active.reports} />
    </div>
  );
}
