'use client';

import { useState } from 'react';
import type { StepScreenshot } from '@/lib/types';
import { getScreenshotUrl } from '@/lib/utils';
import { ImageZoomDialog } from './image-zoom-dialog';

interface StepScreenshotsProps {
  steps: StepScreenshot[];
  runId: string;
}

/** Filmstrip of the screenshots taken at each step of an Android check, in order. */
export function StepScreenshots({ steps, runId }: StepScreenshotsProps) {
  const [selected, setSelected] = useState<{ src: string; title: string } | null>(null);

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-medium-emphasis">Etapas do check</p>
      <ol className="flex gap-3 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const src = getScreenshotUrl(runId, step.path);
          const title = `${i + 1}. ${step.label}`;
          return (
            <li key={step.path} className="shrink-0 w-28">
              <button
                type="button"
                onClick={() => setSelected({ src, title })}
                className="w-full text-left cursor-pointer"
              >
                {/* <img> nativo: o export estático não tem o otimizador do next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={step.label}
                  loading="lazy"
                  className="w-full rounded-lg border border-neutral-100 hover:border-primary-lightest"
                />
                <span className="block mt-1 text-xs leading-tight text-medium-emphasis">
                  {title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <ImageZoomDialog
        src={selected?.src ?? null}
        title={selected?.title ?? ''}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
