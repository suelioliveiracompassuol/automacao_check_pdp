import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatKbps,
  formatMs,
  formatSeconds,
  formatShortDate,
} from '../format';

describe('formatDecimal', () => {
  it('usa vírgula como separador', () => {
    expect(formatDecimal(1.234, 2)).toBe('1,23');
  });
});

describe('formatDate', () => {
  it('formata no fuso de São Paulo', () => {
    expect(formatDate('2024-01-15T13:30:00Z')).toBe('15/01/2024, 10:30:00');
  });
});

describe('formatDateTime', () => {
  it('formata data e hora sem segundos', () => {
    expect(formatDateTime('2024-01-15T13:30:00Z')).toBe('15/01/2024, 10:30');
  });

  it('devolve a entrada quando a data é inválida', () => {
    expect(formatDateTime('não é data')).toBe('não é data');
  });
});

describe('formatShortDate', () => {
  it('formata dia/mês', () => {
    expect(formatShortDate('2024-01-15T13:30:00Z')).toBe('15/01');
  });

  it('usa os 5 primeiros caracteres quando a data é inválida', () => {
    expect(formatShortDate('abcdefgh')).toBe('abcde');
  });
});

describe('formatDuration', () => {
  it('formata milissegundos', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formata segundos', () => {
    expect(formatDuration(3500)).toBe('3.5s');
  });

  it('formata minutos e segundos', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });
});

describe('formatMs', () => {
  it('mostra ms abaixo de 1 s', () => {
    expect(formatMs(849.6)).toBe('850 ms');
  });

  it('mostra segundos com duas casas a partir de 1 s', () => {
    expect(formatMs(2310)).toBe('2,31 s');
  });

  it('usa o valor absoluto para decidir a unidade', () => {
    expect(formatMs(-1500)).toBe('-1,50 s');
  });
});

describe('formatSeconds', () => {
  it('mostra uma casa decimal', () => {
    expect(formatSeconds(2500)).toBe('2,5 s');
  });
});

describe('formatKbps', () => {
  it('converte para Mbps a partir de 1000 kbps', () => {
    expect(formatKbps(9000)).toBe('9 Mbps');
    expect(formatKbps(1500)).toBe('1,5 Mbps');
  });

  it('mantém kbps abaixo de 1000', () => {
    expect(formatKbps(750)).toBe('750 kbps');
  });
});

describe('formatBytes', () => {
  it('trata null', () => {
    expect(formatBytes(null)).toBe('—');
  });

  it('formata B, KB e MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
  });
});
