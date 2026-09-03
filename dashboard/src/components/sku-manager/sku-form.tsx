'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Channel, Country, FeatureKey, SkuEntry, Vendor } from '@/lib/types';

const ALL_FEATURES: FeatureKey[] = [
  'reviews',
  'aiReviewSummary',
  'reviewFilter',
  'reviewSort',
  'reviewPhotos',
  'reviewRecommendation',
  'brandShowcase',
  'recommendationShowcase',
  'shopTheSet',
  'images',
  'pricing',
  'shipping',
  'ratingConsistency',
  'rating',
  'addToCart',
  'favoriteButton',
  'productVariations',
  'contentBanners',
];

const VENDORS: Vendor[] = ['natura', 'avon'];
const COUNTRIES: Country[] = ['BR', 'AR', 'CL', 'CO', 'MX', 'PE'];
const CHANNELS: Channel[] = ['ecommerce', 'socialcommerce'];

interface SkuFormProps {
  open: boolean;
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
  if (entry === null) return DEFAULT_STATE;
  return {
    sku: entry.sku,
    name: entry.name,
    slug: entry.slug ?? '',
    vendor: entry.vendor,
    country: entry.country,
    channel: entry.channel,
    expectedFeatures: entry.expectedFeatures,
  };
}

export function SkuForm({ open, initialData, onSubmit, onClose }: SkuFormProps) {
  const [form, setForm] = useState<FormState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    setForm(toFormState(initialData));
    setErrors({});
    setSubmitError(null);
  }, [open, initialData]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const toggleFeature = (feature: FeatureKey) => {
    setForm((prev) => ({
      ...prev,
      expectedFeatures: prev.expectedFeatures.includes(feature)
        ? prev.expectedFeatures.filter((f) => f !== feature)
        : [...prev.expectedFeatures, feature],
    }));
  };

  const selectAllFeatures = () => {
    setForm((prev) => ({ ...prev, expectedFeatures: [...ALL_FEATURES] }));
  };

  const clearAllFeatures = () => {
    setForm((prev) => ({ ...prev, expectedFeatures: [] }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.sku.trim() === '') next.sku = 'SKU é obrigatório';
    if (form.name.trim() === '') next.name = 'Nome é obrigatório';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError(null);

    try {
      await onSubmit({
        sku: form.sku.trim(),
        name: form.name.trim(),
        slug: form.slug.trim() !== '' ? form.slug.trim() : undefined,
        vendor: form.vendor,
        country: form.country,
        channel: form.channel,
        expectedFeatures: form.expectedFeatures,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o SKU.';
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  };

  const isEditing = initialData !== null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="sku-form-description"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {isEditing === true ? 'Editar SKU' : 'Novo SKU'}
            </Dialog.Title>
            <Dialog.Close
              className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <p id="sku-form-description" className="sr-only">
            {isEditing === true
              ? 'Formulário para editar SKU existente'
              : 'Formulário para criar novo SKU'}
          </p>
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {submitError !== null && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="sku-field" className="text-xs font-medium text-gray-700">
                      SKU{' '}
                      <span className="text-red-500" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="sku-field"
                      type="text"
                      value={form.sku}
                      onChange={(e) => setField('sku', e.target.value)}
                      placeholder="ex: 12345"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      aria-invalid={errors.sku !== undefined ? true : undefined}
                      aria-describedby={errors.sku !== undefined ? 'sku-error' : undefined}
                    />
                    {errors.sku !== undefined && (
                      <p id="sku-error" className="text-[11px] text-red-500" role="alert">
                        {errors.sku}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="name-field" className="text-xs font-medium text-gray-700">
                      Nome{' '}
                      <span className="text-red-500" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      id="name-field"
                      type="text"
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="ex: Hidratante Corporal"
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      aria-invalid={errors.name !== undefined ? true : undefined}
                      aria-describedby={errors.name !== undefined ? 'name-error' : undefined}
                    />
                    {errors.name !== undefined && (
                      <p id="name-error" className="text-[11px] text-red-500" role="alert">
                        {errors.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="slug-field" className="text-xs font-medium text-gray-700">
                    Slug <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    id="slug-field"
                    type="text"
                    value={form.slug}
                    onChange={(e) => setField('slug', e.target.value)}
                    placeholder="ex: hidratante-corporal-p"
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="vendor-field" className="text-xs font-medium text-gray-700">
                      Vendor
                    </label>
                    <select
                      id="vendor-field"
                      value={form.vendor}
                      onChange={(e) => setField('vendor', e.target.value as Vendor)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {VENDORS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="country-field" className="text-xs font-medium text-gray-700">
                      País
                    </label>
                    <select
                      id="country-field"
                      value={form.country}
                      onChange={(e) => setField('country', e.target.value as Country)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="channel-field" className="text-xs font-medium text-gray-700">
                      Canal
                    </label>
                    <select
                      id="channel-field"
                      value={form.channel}
                      onChange={(e) => setField('channel', e.target.value as Channel)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {CHANNELS.map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-700">
                      Features esperadas <span className="text-gray-400">(opcional)</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllFeatures}
                        className="text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-800"
                      >
                        Marcar todas
                      </button>
                      <span className="text-gray-300" aria-hidden="true">
                        |
                      </span>
                      <button
                        type="button"
                        onClick={clearAllFeatures}
                        className="text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-700"
                      >
                        Limpar todas
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-gray-100 bg-gray-50 p-3">
                    {ALL_FEATURES.map((feature) => (
                      <label
                        key={feature}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={form.expectedFeatures.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] text-gray-700">{feature}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading === true}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading === true}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading === true
                  ? 'Salvando…'
                  : isEditing === true
                    ? 'Salvar alterações'
                    : 'Criar SKU'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
