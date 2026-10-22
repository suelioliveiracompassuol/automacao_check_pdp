'use client';

import { m } from 'framer-motion';
import { Card } from './ui/card';
import { RingGauge } from './ui/ring-gauge';
import { passRate as computePassRate } from '@/lib/report';
import { CheckCircle2, XCircle, AlertTriangle, BarChart3 } from 'lucide-react';

interface SummaryCardsProps {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

const items = [
  {
    key: 'total',
    label: 'Total de PDPs',
    icon: BarChart3,
    tone: 'text-primary-darkest bg-primary-wash',
  },
  {
    key: 'passed',
    label: 'Passou',
    icon: CheckCircle2,
    tone: 'text-success bg-success-lightest/50',
  },
  { key: 'failed', label: 'Falhou', icon: XCircle, tone: 'text-alert-dark bg-alert-lightest/60' },
  {
    key: 'errors',
    label: 'Erros',
    icon: AlertTriangle,
    tone: 'text-warning-darkest bg-warning-lightest/70',
  },
] as const;

export function SummaryCards({ total, passed, failed, errors }: SummaryCardsProps) {
  const values = { total, passed, failed, errors };
  const passRate = computePassRate(passed, total);

  return (
    <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <m.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="relative h-full overflow-hidden">
          <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" aria-hidden="true" />
          <div className="flex h-full items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-primary-darkest uppercase">
                Taxa de aprovação
              </p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-highlight">{passRate}%</p>
              <p className="mt-2 text-xs text-medium-emphasis">
                {passed} de {total} PDPs passaram em todas as verificações
              </p>
            </div>
            <RingGauge percent={passRate} size={88} strokeWidth={6} color="var(--color-primary)">
              <span className="text-sm font-bold text-high-emphasis">
                {passed}/{total}
              </span>
            </RingGauge>
          </div>
        </Card>
      </m.div>

      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <m.div
              key={item.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
            >
              <Card className="flex h-full items-center gap-4 py-4">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-2xl font-bold text-highlight">{values[item.key]}</div>
                  <div className="text-xs font-medium text-medium-emphasis">{item.label}</div>
                </div>
              </Card>
            </m.div>
          );
        })}
      </div>
    </div>
  );
}
