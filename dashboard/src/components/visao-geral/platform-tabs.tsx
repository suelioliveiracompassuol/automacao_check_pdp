'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { BetaBadge } from '@/components/beta-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PLATFORM_META } from '@/lib/platforms';
import type { Platform } from '@/lib/types';
import { CoverageSection, type PlatformCoverageData } from './coverage-section';
import { PlatformBreakdownSection, type PlatformBreakdownData } from './platform-breakdown-section';

export interface PlatformSectionData {
  platform: Platform;
  coverage: PlatformCoverageData;
  breakdown: PlatformBreakdownData;
}

function NoDataPanel({ platform }: { platform: Platform }) {
  const { label, upcoming } = PLATFORM_META[platform];
  return (
    <div className="rounded-card border border-dashed border-neutral-100 bg-surface px-6 py-14 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-50 text-low-emphasis">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
      </span>
      {upcoming && (
        <span className="mb-3 inline-block rounded-full bg-secondary-lightest/60 px-2.5 py-0.5 text-[11px] font-bold tracking-widest text-secondary-darkest uppercase">
          Em breve
        </span>
      )}
      <p className="font-bold text-highlight">Ainda não há dados para {label}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-medium-emphasis">
        Cobertura, evolução histórica e matriz de erros aparecem aqui após a primeira execução do
        monitoramento nesta plataforma.
      </p>
    </div>
  );
}

function hasRuns(d: PlatformSectionData) {
  return d.coverage.hasRuns;
}

/** One platform switch driving Cobertura, Evolução Histórica and Matriz de Erros together; the
 * switch is sticky so it stays reachable while scrolling through all three. */
export function PlatformTabs({ data }: { data: PlatformSectionData[] }) {
  const [active, setActive] = useState((data.find(hasRuns) ?? data[0])?.platform);

  if (data.length === 0) return null;

  return (
    <Tabs value={active} onValueChange={(v) => setActive(v as Platform)}>
      <div className="sticky top-17 z-30 -mx-2 mb-8 bg-background/90 px-2 py-3 backdrop-blur-md">
        <TabsList aria-label="Selecionar plataforma">
          {data.map((d) => {
            const meta = PLATFORM_META[d.platform];
            const Icon = meta.icon;
            return (
              <TabsTrigger
                key={d.platform}
                value={d.platform}
                isActive={active === d.platform}
                className={hasRuns(d) || active === d.platform ? undefined : 'opacity-60'}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {meta.label}
                {meta.beta && <BetaBadge />}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {data.map((d) => (
        <TabsContent key={d.platform} value={d.platform} className="space-y-16 outline-none">
          {hasRuns(d) ? (
            <>
              <div id="coverage" className="scroll-mt-40">
                <CoverageSection data={d.coverage} />
              </div>
              <div id="platform-breakdown" className="scroll-mt-40">
                <PlatformBreakdownSection data={d.breakdown} />
              </div>
            </>
          ) : (
            <NoDataPanel platform={d.platform} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
