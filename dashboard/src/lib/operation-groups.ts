import { COUNTRY_INFO, VENDOR_INFO } from '@/lib/constants';
import type { Country, Vendor } from '@/lib/types';

/** Operação de um item (SKU cadastrado ou resultado de PDP). Aceita maiúsculas/minúsculas. */
export interface OperationKey {
  vendor: string;
  country: string;
  /** Ausente = 'ecommerce' (relatórios não gravam o canal padrão). */
  channel?: string;
}

interface GroupDef {
  key: string;
  label: string;
  match: (op: Required<OperationKey>) => boolean;
}

export interface OperationGroup<T> {
  key: string;
  label: string;
  items: T[];
}

function operationGroup(vendor: Vendor, country: Country): GroupDef {
  return {
    key: `${vendor}-${country.toLowerCase()}`,
    label: `${VENDOR_INFO[vendor].label} ${COUNTRY_INFO[country].label}`,
    match: (op) => op.vendor === vendor && op.country === country && op.channel === 'ecommerce',
  };
}

/** Ordem de exibição dos grupos; o que não casar com nenhum vai para "Outros". */
const GROUPS: GroupDef[] = [
  ...(['BR', 'AR', 'CL', 'CO', 'MX', 'PE'] as const).map((c) => operationGroup('natura', c)),
  {
    key: 'social-br',
    label: 'Social Commerce — Minha Loja (BR) Avon/Natura',
    match: (op) => op.channel === 'socialcommerce' && op.country === 'BR',
  },
  ...(['BR', 'AR', 'MX'] as const).map((c) => operationGroup('avon', c)),
];

/** Agrupa itens por operação (vendor × país × canal), na ordem fixa de {@link GROUPS}. Grupos vazios são omitidos. */
export function groupByOperation<T>(
  items: T[],
  operationOf: (item: T) => OperationKey,
): OperationGroup<T>[] {
  const buckets = new Map<string, T[]>();
  const others: T[] = [];

  for (const item of items) {
    const op = operationOf(item);
    const normalized = {
      vendor: op.vendor.toLowerCase(),
      country: op.country.toUpperCase(),
      channel: op.channel ?? 'ecommerce',
    };
    const group = GROUPS.find((g) => g.match(normalized));
    if (!group) {
      others.push(item);
      continue;
    }
    buckets.set(group.key, [...(buckets.get(group.key) ?? []), item]);
  }

  const result: OperationGroup<T>[] = GROUPS.filter((g) => buckets.has(g.key)).map((g) => ({
    key: g.key,
    label: g.label,
    items: buckets.get(g.key)!,
  }));
  if (others.length > 0) {
    result.push({ key: 'outros', label: 'Outros', items: others });
  }
  return result;
}
