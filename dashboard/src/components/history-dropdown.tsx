'use client';

import { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import { History, ChevronDown, Check, CheckCircle2, XCircle } from 'lucide-react';
import { FaAndroid } from 'react-icons/fa';
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
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

  // Close on Escape and hand focus back to the trigger
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={listId}
        aria-label="Histórico de execuções"
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-high-emphasis hover:bg-neutral-75 transition-colors cursor-pointer"
      >
        <History className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Histórico</span>
        <ChevronDown
          aria-hidden="true"
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={listId}
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-neutral-100 overflow-hidden z-50"
        >
          <div className="px-3 py-2 border-b border-neutral-75 bg-neutral-50">
            <span className="text-xs font-semibold text-medium-emphasis uppercase tracking-wide">
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
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                      isCurrent
                        ? 'bg-primary-wash text-primary-darkest'
                        : 'text-high-emphasis hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1 font-medium">
                        {run.platform === 'android' && <FaAndroid className="w-3 h-3" />}
                        {formatDate(run?.startTime)}
                      </span>
                      <span className="text-xs text-low-emphasis mt-0.5">
                        {formatDuration(run.durationMs)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5 text-xs text-success-dark font-semibold tabular-nums">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {run.summary.passed}
                        <span className="sr-only"> aprovados</span>
                      </span>
                      <span className="flex items-center gap-0.5 text-xs text-alert-dark font-semibold tabular-nums">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {run.summary.failed}
                        <span className="sr-only"> reprovados</span>
                      </span>
                      {isCurrent && (
                        <Check className="w-4 h-4 text-primary-darkest" aria-hidden="true" />
                      )}
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
