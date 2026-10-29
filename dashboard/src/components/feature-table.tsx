'use client';

import type { CheckResult } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { summarizeFeatures } from '@/lib/report';
import { cn, getScreenshotUrl } from '@/lib/utils';
import { Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { ImageZoomDialog } from './image-zoom-dialog';

interface FeatureTableProps {
  features: CheckResult[];
  runId: string;
  pageScreenshot?: string;
  /** featureKey → reference image URL; when set, the table gets a "Referência" column */
  featureRefs?: Record<string, string>;
}

export function FeatureTable({ features, runId, pageScreenshot, featureRefs }: FeatureTableProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    src: string;
    title: string;
  } | null>(null);

  if (features.length === 0) {
    return null;
  }

  const { passed, failed, total, percentage } = summarizeFeatures(features);
  const style = (f: CheckResult) =>
    cn(
      'border-t border-neutral-50 transition-colors',
      f.status === 'fail' && 'bg-alert-lightest/60 hover:bg-alert-lightest/50',
      f.status === 'pass' && 'hover:bg-neutral-50/80',
      f.status === 'warning' && 'bg-warning-lightest/40 hover:bg-warning-lightest/60',
      f.status === 'error' && 'bg-primary-wash/60 hover:bg-primary-wash',
      // Muted via background, not opacity, so text keeps AA contrast
      (f.status === 'na' || f.status === 'disabled') && 'bg-neutral-50/60 text-low-emphasis',
    );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs font-medium text-medium-emphasis whitespace-nowrap">
          {passed}/{total} verificações
        </span>
        {/* Track turns red when something failed, so the unfilled share reads as failures */}
        <div
          className={cn(
            'flex-1 h-1.5 rounded-full overflow-hidden',
            failed > 0 ? 'bg-alert-light' : 'bg-neutral-75',
          )}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-success-light to-success transition-all duration-500"
            style={{ width: `${percentage}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Verificações aprovadas"
          />
        </div>
        <span
          className={cn(
            'text-xs font-bold whitespace-nowrap',
            failed > 0 ? 'text-alert-dark' : 'text-success-dark',
          )}
        >
          {percentage}%
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-75">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50/80 text-left">
              <th className="py-2.5 px-3 font-semibold text-medium-emphasis text-xs uppercase tracking-wide w-24">
                Status
              </th>
              <th className="py-2.5 px-3 font-semibold text-medium-emphasis text-xs uppercase tracking-wide">
                Feature
              </th>
              <th className="py-2.5 px-3 font-semibold text-medium-emphasis text-xs uppercase tracking-wide">
                Detalhes
              </th>
              {featureRefs && (
                <th className="py-2.5 px-3 font-semibold text-medium-emphasis text-xs uppercase tracking-wide w-32">
                  Referência
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => (
              <tr key={`${f.featureKey}-${i}`} className={cn(style(f))}>
                <td className="py-2 px-3">
                  <StatusBadge status={f.status} />
                </td>
                <td className="py-2 px-3 font-medium text-high-emphasis text-xs">{f.feature}</td>
                <td className="py-2 px-3 text-medium-emphasis max-w-md text-xs leading-relaxed">
                  {f.message}
                </td>
                {featureRefs && (
                  <td className="py-1.5 px-3">
                    {featureRefs[f.featureKey] ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedScreenshot({
                            src: featureRefs[f.featureKey],
                            title: `Referência — ${f.feature}`,
                          })
                        }
                        className="block rounded border border-neutral-75 bg-white p-0.5 hover:border-primary transition-colors cursor-zoom-in"
                        aria-label={`Ver imagem de referência: ${f.feature}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimizer */}
                        <img
                          src={featureRefs[f.featureKey]}
                          alt=""
                          loading="lazy"
                          className="h-8 max-w-28 object-contain"
                        />
                      </button>
                    ) : (
                      <span
                        className="text-low-emphasis text-xs"
                        aria-label="Sem imagem de referência"
                      >
                        —
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Page screenshot link */}
      {pageScreenshot && (
        <button
          type="button"
          onClick={() =>
            setSelectedScreenshot({
              src: getScreenshotUrl(runId, pageScreenshot),
              title: 'Screenshot da página completa',
            })
          }
          className="flex items-center gap-2 text-xs font-medium text-primary-darkest bg-primary-wash hover:bg-primary-lightest px-3 py-2 rounded-lg transition-colors cursor-pointer mt-2"
        >
          <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
          Ver screenshot da página completa
        </button>
      )}

      <ImageZoomDialog
        src={selectedScreenshot?.src ?? null}
        title={selectedScreenshot?.title ?? ''}
        onClose={() => setSelectedScreenshot(null)}
      />
    </div>
  );
}
