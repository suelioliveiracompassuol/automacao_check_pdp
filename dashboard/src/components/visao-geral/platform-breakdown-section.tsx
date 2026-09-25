'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { MonitoringReport, Platform, ReportIndexEntry } from '@/lib/types';
import { PLATFORM_META } from '@/lib/platforms';
import { EvolutionSection } from './evolution-section';
import { ErrorMatrixSection } from './error-matrix-section';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface PlatformBreakdownData {
  platform: Platform;
  label: string;
  evolutionData: ReportIndexEntry[];
  reports: MonitoringReport[];
}

interface PlatformBreakdownSectionProps {
  /** Every platform in display order (Web first), including those without runs yet — they still
   * get a tab so it's clear each stack has its own history, and open on an empty state. */
  data: PlatformBreakdownData[];
}

function hasRuns(d: PlatformBreakdownData) {
  return d.evolutionData.length > 0;
}

function NoDataPanel({ platform, label }: PlatformBreakdownData) {
  const upcoming = PLATFORM_META[platform].upcoming;
  return (
    <div className="rounded-card border border-dashed border-neutral-100 bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50 text-low-emphasis">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
      </span>
      {upcoming && (
        <span className="mb-3 inline-block rounded-full bg-secondary-lightest/60 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-secondary-darkest uppercase">
          Em breve
        </span>
      )}
      <p className="font-bold text-highlight">Ainda não há dados para {label}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-medium-emphasis">
        A evolução histórica e a matriz de erros aparecem aqui após a primeira execução do
        monitoramento nesta plataforma.
      </p>
    </div>
  );
}

/** Evolução Histórica + Matriz de Erros for one platform at a time, switched via tabs (Web
 * first) instead of stacking a full copy of both sections per platform down the page. */
export function PlatformBreakdownSection({ data }: PlatformBreakdownSectionProps) {
  const [activePlatform, setActivePlatform] = useState((data.find(hasRuns) ?? data[0])?.platform);

  if (data.length === 0) {
    return null;
  }

  return (
    <Tabs
      value={activePlatform}
      onValueChange={(value) => setActivePlatform(value as Platform)}
      className="space-y-8"
    >
      <TabsList aria-label="Selecionar plataforma">
        {data.map((d) => {
          const Icon = PLATFORM_META[d.platform].icon;
          return (
            <TabsTrigger
              key={d.platform}
              value={d.platform}
              isActive={activePlatform === d.platform}
              className={hasRuns(d) || activePlatform === d.platform ? undefined : 'opacity-60'}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {d.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {data.map((d) => (
        <TabsContent key={d.platform} value={d.platform} className="space-y-16 outline-none">
          {hasRuns(d) ? (
            <>
              <EvolutionSection evolutionData={d.evolutionData} />
              <ErrorMatrixSection reports={d.reports} />
            </>
          ) : (
            <NoDataPanel {...d} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
