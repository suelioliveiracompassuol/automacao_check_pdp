import type { ReactNode } from 'react';
import { CalendarClock, Database, Hash, Timer } from 'lucide-react';
import { PLATFORM_META } from '@/lib/platforms';
import { BetaBadge } from '@/components/beta-badge';
import type { MonitoringReport, Platform, SkuSource } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/format';

interface PlatformHeroProps {
  platform: Platform;
  title: string;
  description?: string;
  report: MonitoringReport;
  /** Right-aligned slot — the platform's history dropdown. */
  action?: ReactNode;
}

function MetaPill({
  icon,
  children,
  mono,
}: {
  icon: ReactNode;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-neutral-75 bg-surface px-3 py-1.5 text-xs text-medium-emphasis ${mono ? 'font-mono' : ''}`}
    >
      {icon}
      {children}
    </span>
  );
}

const SKU_SOURCE_LABEL: Record<SkuSource, { label: string; title: string }> = {
  firestore: { label: 'SKUs: Firestore', title: 'Lista de SKUs carregada do Firestore' },
  json: {
    label: 'SKUs: skus.json',
    title: 'Firestore indisponível nesta execução — lista de SKUs veio do config/skus.json',
  },
};

/** Page header shared by /web and /android (latest run and run detail routes). */
export function PlatformHero({ platform, title, description, report, action }: PlatformHeroProps) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;

  return (
    <section
      data-platform={platform}
      // Sem overflow-hidden aqui: o menu do Histórico precisa abrir por cima dos cards abaixo.
      // Quem recorta as decorações é a camada interna.
      className="relative z-10 rounded-card border border-platform-soft/60 bg-platform-wash px-6 py-7 sm:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
      >
        {/* Faixa no topo + ícone grande ao fundo: identificam a plataforma além da cor */}
        <div className="absolute inset-x-0 top-0 h-1 bg-platform" />
        <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-platform-glow/50 blur-3xl" />
        <div className="absolute right-40 -bottom-28 h-56 w-56 rounded-full bg-platform-soft/50 blur-3xl" />
        <Icon className="absolute -right-6 -bottom-10 h-48 w-48 text-platform opacity-[0.08] max-sm:h-32 max-sm:w-32" />
      </div>
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-platform-strong px-3 py-1 text-xs font-bold text-white shadow-tiny">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.label}
            </span>
            <span className="text-xs font-medium text-platform-strong">{meta.channel}</span>
            {meta.beta && <BetaBadge />}
          </div>
          {action}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-highlight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-medium-emphasis">{description}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <MetaPill icon={<CalendarClock className="h-3.5 w-3.5 text-platform-strong" />}>
            {formatDate(report.startTime)}
          </MetaPill>
          <MetaPill icon={<Timer className="h-3.5 w-3.5 text-platform-strong" />}>
            {formatDuration(report.durationMs)}
          </MetaPill>
          <MetaPill icon={<Hash className="h-3.5 w-3.5 text-platform-strong" />} mono>
            {report.runId}
          </MetaPill>
          {report.skuSource && (
            <span title={SKU_SOURCE_LABEL[report.skuSource].title}>
              <MetaPill icon={<Database className="h-3.5 w-3.5 text-platform-strong" />}>
                {SKU_SOURCE_LABEL[report.skuSource].label}
              </MetaPill>
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
