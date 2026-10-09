'use client';

import { Camera } from 'lucide-react';
import { useState } from 'react';
import { basePath } from '@/lib/config';
import { ImageZoomDialog } from './image-zoom-dialog';

interface ScreenshotViewerProps {
  screenshots: string[];
  runId: string;
}

export function ScreenshotViewer({ screenshots, runId }: ScreenshotViewerProps) {
  const [selected, setSelected] = useState<string | null>(null);

  if (screenshots.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {screenshots.map((file) => (
          <button
            key={file}
            type="button"
            onClick={() => setSelected(file)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-darkest bg-primary-wash hover:bg-primary-lightest px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            {file
              .replace(/\.png$/, '')
              .split('_')
              .slice(-2, -1)
              .join('')}
          </button>
        ))}
      </div>

      <ImageZoomDialog
        src={selected !== null ? `${basePath}/reports/${runId}/screenshots/${selected}` : null}
        title={selected ?? ''}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
