'use client';

import { useState } from 'react';
import { SelectField, TextField } from '@/components/ui/form-field';
import { Modal, ModalCloseButton, ModalTitle, modalButtonClass } from '@/components/ui/modal';
import { ALL_FEATURE_KEYS, CHANNELS, COUNTRIES, VENDORS } from '@/lib/constants';
import type { Channel, Country, FeatureKey, SkuEntry, Vendor } from '@/lib/types';

interface SkuFormProps {
  open: boolean;
  /** Estado inicial do formulário; o pai troca a `key` ao abrir para reiniciá-lo. */
  initialData: SkuEntry | null;
  onSubmit: (data: Omit<SkuEntry, 'id'>) => Promise<void>;
  onClose: () => void;
}

interface FormState {
  sku: string;
  name: string;
  slug: string;
  vendor: Vendor;
  country: Country;
  channel: Channel;
  expectedFeatures: FeatureKey[];
}

type FormErrors = Partial<Record<'sku' | 'name', string>>;

const DEFAULT_STATE: FormState = {
  sku: '',
  name: '',
  slug: '',
  vendor: 'natura',
  country: 'BR',
  channel: 'ecommerce',
  expectedFeatures: [],
};

function toFormState(entry: SkuEntry | null): FormState {
  if (entry === null) {
    return DEFAULT_STATE;
  }
  return { ...entry, slug: entry.slug ?? '' };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.sku.trim() === '') {
    errors.sku = 'SKU é obrigatório';
  }
  if (form.name.trim() === '') {
    errors.name = 'Nome é obrigatório';
  }
  return errors;
}

export function SkuForm({ open, initialData, onSubmit, onClose }: SkuFormProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialData));
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const isEditing = initialData !== null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleFeature = (feature: FeatureKey) => {
    setField(
      'expectedFeatures',
      form.expectedFeatures.includes(feature)
        ? form.expectedFeatures.filter((f) => f !== feature)
        : [...form.expectedFeatures, feature],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    setSubmitError(null);
    try {
      await onSubmit({
        sku: form.sku.trim(),
        name: form.name.trim(),
        slug: form.slug.trim() || undefined,
        vendor: form.vendor,
        country: form.country,
        channel: form.channel,
        expectedFeatures: form.expectedFeatures,
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o SKU.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      describedBy="sku-form-description"
      className="flex max-h-[90dvh] max-w-lg flex-col"
    >
      <div className="flex items-center justify-between border-b border-neutral-75 px-6 py-4">
        <ModalTitle className="text-base font-semibold text-highlight">
          {isEditing ? 'Editar SKU' : 'Novo SKU'}
        </ModalTitle>
        <ModalCloseButton />
      </div>
      <p id="sku-form-description" className="sr-only">
        {isEditing ? 'Formulário para editar SKU existente' : 'Formulário para criar novo SKU'}
      </p>
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {submitError !== null && (
            <div
              role="alert"
              className="rounded-xl border border-alert-light/60 bg-alert-lightest/50 px-3 py-2 text-sm text-alert-dark"
            >
              {submitError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="sku-field"
              label="SKU"
              required
              value={form.sku}
              onChange={(v) => setField('sku', v)}
              placeholder="ex: 12345"
              error={errors.sku}
            />
            <TextField
              id="name-field"
              label="Nome"
              required
              value={form.name}
              onChange={(v) => setField('name', v)}
              placeholder="ex: Hidratante Corporal"
              error={errors.name}
            />
          </div>
          <TextField
            id="slug-field"
            label="Slug"
            optional
            value={form.slug}
            onChange={(v) => setField('slug', v)}
            placeholder="ex: hidratante-corporal-p"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SelectField
              id="vendor-field"
              label="Vendor"
              value={form.vendor}
              options={VENDORS}
              onChange={(v) => setField('vendor', v)}
            />
            <SelectField
              id="country-field"
              label="País"
              value={form.country}
              options={COUNTRIES}
              onChange={(v) => setField('country', v)}
            />
            <SelectField
              id="channel-field"
              label="Canal"
              value={form.channel}
              options={CHANNELS}
              onChange={(v) => setField('channel', v)}
            />
          </div>
          <div role="group" aria-labelledby="features-label" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p id="features-label" className="text-xs font-medium text-high-emphasis">
                Features esperadas <span className="text-low-emphasis">(opcional)</span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setField('expectedFeatures', [...ALL_FEATURE_KEYS])}
                  className="text-xs font-medium text-primary-darkest transition-colors hover:underline"
                >
                  Marcar todas
                </button>
                <span className="text-neutral-300" aria-hidden="true">
                  |
                </span>
                <button
                  type="button"
                  onClick={() => setField('expectedFeatures', [])}
                  className="text-xs font-medium text-medium-emphasis transition-colors hover:text-high-emphasis"
                >
                  Limpar todas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 rounded-xl border border-neutral-75 bg-neutral-50 p-3 sm:grid-cols-2">
              {ALL_FEATURE_KEYS.map((feature) => (
                <label
                  key={feature}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white"
                >
                  <input
                    type="checkbox"
                    checked={form.expectedFeatures.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="h-4 w-4 shrink-0 rounded border-neutral-200 text-primary-darkest focus:ring-primary"
                  />
                  <span className="text-xs text-high-emphasis">{feature}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-neutral-75 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className={modalButtonClass.secondary}
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading} className={modalButtonClass.primary}>
            {loading ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar SKU'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
