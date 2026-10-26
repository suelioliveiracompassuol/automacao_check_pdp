import type { MonitoringReport, ReportIndexEntry } from '@/lib/types';
import { EvolutionSection } from './evolution-section';
import { ErrorMatrixSection } from './error-matrix-section';

export interface PlatformBreakdownData {
  evolutionData: ReportIndexEntry[];
  reports: MonitoringReport[];
}

/** Evolução Histórica + Matriz de Erros for the platform selected in PlatformTabs. */
export function PlatformBreakdownSection({ data }: { data: PlatformBreakdownData }) {
  return (
    <div className="space-y-16">
      <EvolutionSection evolutionData={data.evolutionData} />
      <ErrorMatrixSection reports={data.reports} />
    </div>
  );
}
