import type { LucideIcon } from 'lucide-react';

interface HeroMetricProps {
  label: string;
  value: string;
  icon: LucideIcon;
}

export function HeroMetric({ label, value, icon: Icon }: HeroMetricProps) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
      <Icon className="mb-2 h-5 w-5 text-indigo-300" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-indigo-200/70">{label}</div>
    </div>
  );
}
