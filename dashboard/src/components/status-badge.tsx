import { cn } from '@/lib/utils';
import type { Status } from '@/lib/types';
import { Check, X, AlertTriangle, Minus, Ban } from 'lucide-react';

const statusConfig: Record<Status, { label: string; icon: typeof Check; colors: string }> = {
  pass: {
    label: 'Passou',
    icon: Check,
    colors: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  fail: {
    label: 'Falhou',
    icon: X,
    colors: 'bg-red-100 text-red-700 border-red-200',
  },
  error: {
    label: 'Erro',
    icon: AlertTriangle,
    colors: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  warning: {
    label: 'Alerta',
    icon: AlertTriangle,
    colors: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  disabled: {
    label: 'Off',
    icon: Ban,
    colors: 'bg-gray-100 text-gray-500 border-gray-200',
  },
  na: {
    label: 'N/A',
    icon: Minus,
    colors: 'bg-gray-50 text-gray-400 border-gray-200',
  },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.na;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
        config.colors,
        className,
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
