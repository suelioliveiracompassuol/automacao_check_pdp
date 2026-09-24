import type { ReactNode } from 'react';
import { CalendarClock, Hash, Timer } from 'lucide-react';
import { PLATFORM_META } from '@/lib/platforms';
import type { MonitoringReport, Platform } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/utils';

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

/** Page header shared by /web and /android (latest run and run detail routes). */
export function PlatformHero({ platform, title, description, report, action }: PlatformHeroProps) {
  const meta = PLATFORM_META[platform];
  const Icon = meta.icon;

  return (
    <section className="relative overflow-hidden rounded-card border border-primary-lightest/60 bg-primary-wash px-6 py-7 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-secondary-lightest/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 right-40 h-56 w-56 rounded-full bg-primary-lightest/50 blur-3xl"
      />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-bold text-primary-darkest shadow-tiny">
            <Icon className="h-3.5 w-3.5 text-brand" />
            {meta.channel}
          </span>
          {action}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-highlight md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-medium-emphasis">{description}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <MetaPill icon={<CalendarClock className="h-3.5 w-3.5 text-primary-dark" />}>
            {formatDate(report.startTime)}
          </MetaPill>
          <MetaPill icon={<Timer className="h-3.5 w-3.5 text-primary-dark" />}>
            {formatDuration(report.durationMs)}
          </MetaPill>
          <MetaPill icon={<Hash className="h-3.5 w-3.5 text-primary-dark" />} mono>
            {report.runId}
          </MetaPill>
        </div>
      </div>
    </section>
  );
}
