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
      <div className="mb-6">
        <h2 id="coverage-heading" className="text-2xl font-bold text-gray-900">
          Cobertura
        </h2>
        <p className="mt-1 text-sm text-gray-500">Países e tipos de verificação monitorados</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {Object.entries(COUNTRY_INFO).map(([code, { label }]) => (
          <div
            key={code}
            className={cn(
              'flex flex-col items-center rounded-xl border p-4 text-center',
              countries.includes(code)
                ? 'border-indigo-100 bg-indigo-50'
                : 'border-gray-100 bg-white',
            )}
          >
            <img
              src={getCountryFlag(code)}
              alt={`Bandeira do ${label}`}
              width={28}
              height={20}
              className="mb-1 h-5 w-7 rounded-sm object-cover"
            />
            <span className="text-sm font-bold text-gray-800">{label}</span>
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
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
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
