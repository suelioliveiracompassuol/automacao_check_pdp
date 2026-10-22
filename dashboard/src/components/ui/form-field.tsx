import type { ReactNode } from 'react';

/** Estilo base de input/select dos formulários e filtros. */
export const fieldControlClass =
  'rounded-lg border border-neutral-100 bg-white px-3 py-2 text-sm text-highlight placeholder-low-emphasis outline-none transition-colors focus:border-primary-light focus:ring-2 focus:ring-primary-lightest';

interface FieldShellProps {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}

function FieldShell({ id, label, required, optional, error, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-high-emphasis">
        {label}
        {required && (
          <span className="text-alert-dark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {optional && <span className="text-low-emphasis"> (opcional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-xs text-alert-dark" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends Omit<FieldShellProps, 'children'> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function TextField({ value, onChange, placeholder, ...shell }: TextFieldProps) {
  return (
    <FieldShell {...shell}>
      <input
        id={shell.id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={shell.error ? true : undefined}
        aria-describedby={shell.error ? `${shell.id}-error` : undefined}
        className={fieldControlClass}
      />
    </FieldShell>
  );
}

interface SelectFieldProps<T extends string> extends Omit<FieldShellProps, 'children'> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  ...shell
}: SelectFieldProps<T>) {
  return (
    <FieldShell {...shell}>
      <select
        id={shell.id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={fieldControlClass}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
