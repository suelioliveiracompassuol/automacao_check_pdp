import { HistoryDropdown } from '@/components/history-dropdown';
import { getReportsByPlatform } from '@/lib/data';
import { PLATFORM_META } from '@/lib/platforms';
import type { Platform } from '@/lib/types';

const MAX_RUNS = 15;

/** Histórico de execuções de uma plataforma, com links sob a rota dela (/web, /android).
 * Entradas sem `platform` são execuções Web legadas e contam como Web. */
export function PlatformHistoryDropdown({ platform }: { platform: Platform }) {
  const runs = getReportsByPlatform(platform).slice(0, MAX_RUNS);
  const { href } = PLATFORM_META[platform];

  return <HistoryDropdown runs={runs} basePath={href} homeHref={href} />;
}
