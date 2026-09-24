import { SectionHeader } from '@/components/ui/card';
import { cn, getCountryFlag } from '@/lib/utils';
import { COUNTRY_INFO } from '@/lib/types';
import { VENDOR_LABELS } from './content';
import { ChecksOverview } from '@/components/checks-overview';

interface CoverageSectionProps {
  countries: string[];
  channelsByCountry: Map<string, Set<string>>;
  vendorsByCountry: Map<string, Set<string>>;
}

export function CoverageSection({
  countries,
  channelsByCountry,
  vendorsByCountry,
}: CoverageSectionProps) {
  return (
    <section aria-labelledby="coverage-heading">
      <SectionHeader
        id="coverage-heading"
        eyebrow="Escopo"
        title="Cobertura"
        description="Países e tipos de verificação monitorados"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {Object.entries(COUNTRY_INFO).map(([code, { label }]) => (
          <div
            key={code}
            className={cn(
              'flex flex-col items-center rounded-2xl border p-4 text-center',
              countries.includes(code)
                ? 'border-primary-lightest bg-primary-wash'
                : 'border-neutral-75 bg-surface opacity-60',
            )}
          >
            <img
              src={getCountryFlag(code)}
              alt={`Bandeira do ${label}`}
              width={28}
              height={20}
              className="mb-1 h-5 w-7 rounded-sm object-cover"
            />
            <span className="text-sm font-bold text-high-emphasis">{label}</span>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {[...(vendorsByCountry.get(code) ?? [])].map((vendor) => {
                const info = VENDOR_LABELS[vendor];
                if (!info) return null;
                return (
                  <span
                    key={vendor}
                    className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', info.className)}
                  >
                    {info.label}
                  </span>
                );
              })}
              {channelsByCountry.get(code)?.has('socialcommerce') && (
                <span className="rounded-full bg-info-lightest px-2 py-0.5 text-[10px] font-bold text-info-dark">
                  Minha Loja
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <ChecksOverview />
    </section>
  );
}
