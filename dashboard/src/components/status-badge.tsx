import { cn } from '@/lib/utils';
import type { Status } from '@/lib/types';
import { Check, X, AlertTriangle, Minus, Ban } from 'lucide-react';

const statusConfig: Record<Status, { label: string; icon: typeof Check; colors: string }> = {
  pass: {
    label: 'Passou',
    icon: Check,
    colors: 'bg-success-lightest text-success-dark border-success-light/60',
  },
  fail: {
    label: 'Falhou',
    icon: X,
    colors: 'bg-alert-lightest text-alert-dark border-alert-light/60',
  },
  error: {
    label: 'Erro',
    icon: AlertTriangle,
    colors: 'bg-warning-lightest text-warning-darkest border-warning-light/60',
  },
  warning: {
    label: 'Alerta',
    icon: AlertTriangle,
    colors: 'bg-warning-lightest text-warning-darkest border-warning-light/60',
  },
  disabled: {
    label: 'Off',
    icon: Ban,
    colors: 'bg-neutral-75 text-medium-emphasis border-neutral-100',
  },
  na: {
    label: 'N/A',
    icon: Minus,
    colors: 'bg-neutral-50 text-low-emphasis border-neutral-100',
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
