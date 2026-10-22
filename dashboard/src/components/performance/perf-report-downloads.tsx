import { Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { PerfReportDownloads as PerfReportDownloadsData } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { PAGE_TYPE_LABEL } from '@/lib/perf-thresholds';
import { getPerfFileUrl, perfReportDownloadName } from '@/lib/utils';

interface PerfReportDownloadsProps {
  runs: PerfReportDownloadsData[];
  days: number;
}

const LIGHTHOUSE_VIEWER_URL = 'https://googlechrome.github.io/lighthouse/viewer/';

/** Relatórios completos do Lighthouse (JSON) das últimas medições, para download. */
export function PerfReportDownloads({ runs, days }: PerfReportDownloadsProps) {
  return (
    <section aria-labelledby="perf-downloads-title" className="space-y-4">
      <div>
        <h2 id="perf-downloads-title" className="text-lg font-bold text-highlight">
          Relatórios do Lighthouse
        </h2>
        <p className="text-xs text-medium-emphasis">
          Relatório completo (JSON) da execução mediana de cada SKU, dos últimos {days} dias. Para
          visualizar, abra o arquivo no{' '}
          <a
            href={LIGHTHOUSE_VIEWER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-dark hover:underline"
          >
            Lighthouse Viewer
          </a>
          .
        </p>
      </div>

      <Card className="p-0">
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-low-emphasis">
            Nenhum relatório disponível nos últimos {days} dias.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-75">
            {runs.map((run) => (
              <li
                key={run.runId}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <span className="text-sm font-medium text-high-emphasis tabular-nums">
                  {formatDateTime(run.timestamp)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {run.files.map((file) => (
                    <a
                      key={file.path}
                      href={getPerfFileUrl(file.path)}
                      download={perfReportDownloadName(file.path)}
                      title={file.name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-75 bg-neutral-50 px-3 py-1 text-xs font-semibold text-primary-darkest transition-colors hover:bg-primary-wash"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      {file.pageType ? PAGE_TYPE_LABEL[file.pageType] : file.sku}
                      <span className="sr-only">
                        {' '}
                        ({file.sku}, {formatDateTime(run.timestamp)})
                      </span>
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
