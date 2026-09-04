import { cn } from '@/lib/utils';
import { CHECKS_CATALOG, TOTAL_CHECKS } from '@/lib/checks-catalog';

/** Shared with the /apresentacao coverage section — same catalog, same card style, always in sync. */
export function ChecksOverview() {
  return (
    <section aria-labelledby="checks-overview-heading" className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h2 id="checks-overview-heading" className="text-lg font-bold text-gray-900">
          O que verificamos em cada PDP
        </h2>
        <span className="text-xs text-gray-400">{TOTAL_CHECKS} checagens automáticas</span>
      </div>
      {CHECKS_CATALOG.map((category) => (
        <div key={category.title}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {category.title}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {category.items.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl',
                    item.bg,
                  )}
                >
                  {item.emoji}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{item.name}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
