'use client';

import { motion } from 'framer-motion';
import { Card } from './ui/card';
import { CheckCircle2, XCircle, AlertTriangle, BarChart3 } from 'lucide-react';

interface SummaryCardsProps {
  total: number;
  passed: number;
  failed: number;
  errors: number;
}

function ProgressRing({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width="88" height="88" className="transform -rotate-90">
      <circle
        cx="44"
        cy="44"
        r="38"
        fill="none"
        stroke="currentColor"
        className="text-neutral-75"
        strokeWidth="6"
      />
      <circle
        cx="44"
        cy="44"
        r="38"
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
        style={{ animation: 'progressRing 1s ease-out forwards' }}
      />
    </svg>
  );
}

const items = [
  {
    key: 'total',
    label: 'Total de PDPs',
    icon: BarChart3,
    tone: 'text-primary-dark bg-primary-wash',
  },
  {
    key: 'passed',
    label: 'Passou',
    icon: CheckCircle2,
    tone: 'text-success bg-success-lightest/50',
  },
  { key: 'failed', label: 'Falhou', icon: XCircle, tone: 'text-alert bg-alert-lightest/60' },
  {
    key: 'errors',
    label: 'Erros',
    icon: AlertTriangle,
    tone: 'text-warning-darkest bg-warning-lightest/70',
  },
] as const;

export function SummaryCards({ total, passed, failed, errors }: SummaryCardsProps) {
  const values = { total, passed, failed, errors };
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="relative h-full overflow-hidden">
          <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" aria-hidden="true" />
          <div className="flex h-full items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-primary-dark uppercase">
                Taxa de aprovação
              </p>
              <p className="mt-1 text-5xl font-bold tracking-tight text-highlight">{passRate}%</p>
              <p className="mt-2 text-xs text-medium-emphasis">
                {passed} de {total} PDPs passaram em todas as verificações
              </p>
            </div>
            <div className="relative shrink-0">
              <ProgressRing value={passed} max={total} color="#f48646" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-high-emphasis">
                  {passed}/{total}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
