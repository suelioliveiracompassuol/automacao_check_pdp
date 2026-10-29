import { describe, expect, it } from 'vitest';
import { groupByOperation, type OperationKey } from '../operation-groups';

const op = (vendor: string, country: string, channel?: string): OperationKey => ({
  vendor,
  country,
  channel,
});

describe('groupByOperation', () => {
  it('agrupa na ordem fixa: Natura, Social Commerce, Avon', () => {
    const groups = groupByOperation(
      [
        op('avon', 'BR'),
        op('natura', 'BR', 'socialcommerce'),
        op('natura', 'PE'),
        op('natura', 'BR'),
      ],
      (o) => o,
    );
    expect(groups.map((g) => g.label)).toEqual([
      'Natura Brasil',
      'Natura Peru',
      'Social Commerce — Minha Loja (BR) Avon/Natura',
      'Avon Brasil',
    ]);
  });

  it('normaliza caixa e trata canal ausente como ecommerce (formato dos relatórios)', () => {
    const groups = groupByOperation(
      [op('Natura', 'br'), op('AVON', 'br', 'socialcommerce')],
      (o) => o,
    );
    expect(groups.map((g) => g.key)).toEqual(['natura-br', 'social-br']);
  });

  it('junta Avon e Natura do Social Commerce no mesmo grupo', () => {
    const groups = groupByOperation(
      [op('avon', 'BR', 'socialcommerce'), op('natura', 'BR', 'socialcommerce')],
      (o) => o,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it('manda operações desconhecidas para "Outros", no fim', () => {
    const groups = groupByOperation([op('natura', 'XX'), op('natura', 'BR')], (o) => o);
    expect(groups.map((g) => g.label)).toEqual(['Natura Brasil', 'Outros']);
  });

  it('omite grupos vazios', () => {
    expect(groupByOperation([], (o: OperationKey) => o)).toEqual([]);
  });
});
