import Link from 'next/link';

export function NavHeader() {
  return (
    <header id="app-nav-header" className="sticky top-0 z-40 bg-surface/90 backdrop-blur-lg">
      <div className="bg-brand-gradient h-1" aria-hidden="true" />
      <div className="border-b border-neutral-75">
        <div className="mx-auto flex h-16 max-w-360 items-center justify-between px-4 sm:px-8 lg:px-10">
          <Link href="/" className="group flex items-center gap-3">
            {/* <span className="text-2xl leading-none font-bold tracking-tight text-brand lowercase">
              natura
            </span> */}
            {/* <span className="h-6 w-px bg-neutral-100" aria-hidden="true" /> */}
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-highlight transition-colors group-hover:text-primary-dark">
                PDP Monitor
              </span>
              <span className="hidden text-[11px] text-medium-emphasis sm:block">
                Página de Detalhes de Produto
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-success-lightest bg-success-lightest/50 px-3 py-1.5 text-xs font-medium text-success-dark">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="hidden sm:inline">Automação ativa</span>
          </div>
        </div>
      </div>
    </header>
  );
}
