/** Formatação pt-BR compartilhada — datas sempre no fuso de São Paulo, decimais com vírgula. */

const TIME_ZONE = 'America/Sao_Paulo';

function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Número com casas decimais fixas e vírgula como separador. */
export function formatDecimal(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',');
}

/** "dd/mm/aaaa hh:mm:ss" — data/hora completa de uma execução. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: TIME_ZONE,
  });
}

/** "dd/mm/aaaa hh:mm"; devolve a string original se não for uma data válida. */
export function formatDateTime(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  });
}

/** "dd/mm" para eixos e listas compactas. */
export function formatShortDate(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso.slice(0, 5);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE });
}

/** Duração de uma execução do monitor: "500ms", "3.5s", "2m 5s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

/** Tempo de métrica web: "850 ms" abaixo de 1 s, senão "2,31 s". */
export function formatMs(ms: number): string {
  if (Math.abs(ms) < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${formatDecimal(ms / 1000, 2)} s`;
}

/** Segundos com uma casa, para ticks de eixo: "2,5 s". */
export function formatSeconds(ms: number): string {
  return `${formatDecimal(ms / 1000, 1)} s`;
}

export function formatKbps(kbps: number): string {
  return kbps >= 1000 ? `${String(kbps / 1000).replace('.', ',')} Mbps` : `${kbps} kbps`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) {
    return '—';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${formatDecimal(bytes / (1024 * 1024), 1)} MB`;
}
