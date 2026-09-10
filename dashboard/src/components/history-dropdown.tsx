'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { History, ChevronDown, Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReportIndexEntry } from '@/lib/types';
import { formatDate, formatDuration } from '@/lib/utils';

interface HistoryDropdownProps {
  runs: ReportIndexEntry[];
  /** runId currently shown at `homeHref` — NOT necessarily runs[0], since other platforms
   * (e.g. Android) can be inserted at the front of the same index without updating
   * last-report.json. */
  homeRunId?: string;
  /** Route prefix for non-home entries. Defaults to '/report' (web reports). */
  basePath?: string;
  /** Link used for the "home" entry (the one matching homeRunId). Defaults to '/'. */
  homeHref?: string;
}

export function HistoryDropdown({
  runs,
  homeRunId,
  basePath = '/report',
  homeHref = '/',
}: HistoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const resolvedHomeRunId = homeRunId ?? runs[0]?.runId;

  // Determine current runId from URL
  const currentRunId = pathname.includes(`${basePath}/`)
    ? pathname.split(`${basePath}/`)[1]?.replace(/\/$/, '')
    : resolvedHomeRunId; // Home = whatever last-report.json actually holds

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
      >
        <History className="w-4 h-4" />
        <span className="hidden sm:inline">Histórico</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Execuções recentes
            </span>
          </div>
          <ul className="max-h-96 overflow-y-auto py-1">
            {runs.map((run) => {
              const isCurrent = run.runId === currentRunId;
              const href = run.runId === resolvedHomeRunId ? homeHref : `${basePath}/${run.runId}/`;

              return (
                <li key={run.runId}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                      isCurrent ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {run.platform === 'android' && '📱 '}
                        {formatDate(run?.startTime)}
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5">
                        {formatDuration(run.durationMs)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-600 font-semibold">
                        ✅{run.summary.passed}
                      </span>
                      <span className="text-xs text-red-600 font-semibold">
                        ❌{run.summary.failed}
                      </span>
                      {isCurrent && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
