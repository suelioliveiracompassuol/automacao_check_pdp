import { cn, getCountryFlag } from '@/lib/utils';

const CHECK_CARDS = [
  {
    key: 'contentBanners',
    emoji: '🖼️',
    name: 'Banners de Conteúdo',
    desc: 'Detecta imagens quebradas (404)',
    bg: 'bg-amber-50',
  },
  {
    key: 'i18nKeys',
    emoji: '🌐',
    name: 'Chaves de i18n',
    desc: 'Textos de acessibilidade não traduzidos',
    bg: 'bg-violet-50',
  },
  {
    key: 'ratingConsistency',
    emoji: '🔗',
    name: 'API de Reviews',
    desc: 'Valida o rating da página contra a API /reviews/v2/details',
    bg: 'bg-red-50',
  },
  {
    key: 'reviewPhotos',
    emoji: '📸',
    name: 'Fotos nas Avaliações',
    desc: 'Feature de fotos de clientes ativa',
    bg: 'bg-sky-50',
  },
  {
    key: 'reviewRecommendation',
    emoji: '👍',
    name: 'Recomendação de Reviews',
    desc: 'Chip de recomendação visível',
    bg: 'bg-green-50',
  },
  {
    key: 'addToCart',
    emoji: '🛒',
    name: 'Adicionar ao Carrinho',
    desc: 'Botão funcional e acessível',
    bg: 'bg-fuchsia-50',
  },
  {
    key: 'favoriteButton',
    emoji: '❤️',
    name: 'Botão de Favorito',
    desc: 'Funcionalidade de wishlist',
    bg: 'bg-pink-50',
  },
  {
    key: 'productVariations',
    emoji: '🎨',
    name: 'Variações do Produto',
    desc: 'Seletores de cor/tamanho funcionais',
    bg: 'bg-emerald-50',
  },
  {
    key: 'remoteConfig',
    emoji: '🔧',
    name: 'Feature Flags',
    desc: 'Remote Config e flags de features',
    bg: 'bg-yellow-50',
  },
  {
    key: 'aiReviewSummary',
    emoji: '🤖',
    name: 'AI Review Summary',
    desc: 'Resumo de avaliações porIA',
    bg: 'bg-purple-50',
  },
] as const;

const COUNTRY_INFO: Record<string, { label: string }> = {
  AR: { label: 'Argentina' },
  BR: { label: 'Brasil' },
  CL: { label: 'Chile' },
  CO: { label: 'Colômbia' },
  MX: { label: 'México' },
  PE: { label: 'Peru' },
};

interface CoverageSectionProps {
  countries: string[];
  channelsByCountry: Map<string, Set<string>>;
}

export function CoverageSection({ countries, channelsByCountry }: CoverageSectionProps) {
  return (
    <section aria-labelledby="coverage-heading">
      <div className="mb-6">
        <h2 id="coverage-heading" className="text-2xl font-bold text-gray-900">
          Cobertura
        </h2>
        <p className="mt-1 text-sm text-gray-500">Países e tipos de verificação monitorados</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3sm:grid-cols-3md:grid-cols-6">
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
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">
                Natura
              </span>
              {channelsByCountry.get(code)?.has('socialcommerce') && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                  Minha Loja
                </span>
              )}
              {['AR', 'BR', 'MX'].includes(code) && (
                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-800">
                  Avon
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3xl:grid-cols-4">
        {CHECK_CARDS.map(({ key, emoji, name, desc, bg }) => (
          <div
            key={key}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl',
                bg,
              )}
            >
              {emoji}
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">{name}</div>
              <div className="mt-0.5 text-xs text-gray-500">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
