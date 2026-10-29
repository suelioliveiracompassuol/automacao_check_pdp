interface OperationGroupHeaderProps {
  /** Usado no id do título, para o `aria-labelledby` da seção. */
  groupKey: string;
  label: string;
  count: number;
  /** Nível do título conforme a página (h2 quando não há título de seção acima). */
  as?: 'h2' | 'h3';
}

/** Título de grupo por operação (ex.: "NATURA BRASIL  8 ———"). */
export function OperationGroupHeader({
  groupKey,
  label,
  count,
  as: Heading = 'h3',
}: OperationGroupHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <Heading
        id={`group-${groupKey}`}
        className="text-xs font-semibold uppercase tracking-widest text-low-emphasis"
      >
        {label}
      </Heading>
      <span className="rounded-full bg-neutral-75 px-2 py-0.5 text-[11px] font-medium text-medium-emphasis">
        {count}
      </span>
      <div className="h-px flex-1 bg-neutral-75" aria-hidden="true" />
    </div>
  );
}
