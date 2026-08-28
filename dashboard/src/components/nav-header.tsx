import Link from 'next/link';
import { Activity, Zap } from 'lucide-react';
import { getReportIndex } from '@/lib/data';
import { HistoryDropdown } from './history-dropdown';

export function NavHeader() {
  const index = getReportIndex();
  const runs = index.reports.slice(0, 15);

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-gray-900 hover:text-indigo-600 transition-colors group"
        >
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg opacity-20 group-hover:opacity-40 transition-opacity blur" />
            <div className="relative bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg p-1.5">
              <Activity className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-lg tracking-tight">PDP Monitor</span>
            <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              v2.0
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Automação ativa</span>
          </div>
          <HistoryDropdown runs={runs} />
        </div>
      </div>
    </header>
  );
}
