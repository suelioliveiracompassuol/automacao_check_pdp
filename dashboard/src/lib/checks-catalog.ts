export interface ChecklistItem {
  key: string;
  emoji: string;
  name: string;
  desc: string;
  bg: string;
}

export interface ChecklistCategory {
  title: string;
  items: ChecklistItem[];
}

/**
 * Single source of truth for "what we check on every PDP" — used both on the home page
 * (ChecksOverview) and on the /apresentacao coverage section, so the two never drift apart.
 */
export const CHECKS_CATALOG: ChecklistCategory[] = [
  {
    title: 'Avaliações & Nota',
    items: [
      {
        key: 'reviews',
        emoji: '⭐',
        name: 'Avaliações',
        desc: 'Seção de reviews presente e carregada',
        bg: 'bg-yellow-50',
      },
      {
        key: 'aiReviewSummary',
        emoji: '🤖',
        name: 'Resumo por IA',
        desc: 'Resumo gerado por IA das avaliações',
        bg: 'bg-purple-50',
      },
      {
        key: 'reviewFilter',
        emoji: '🔍',
        name: 'Filtro de reviews',
        desc: 'Filtros de nota/atributo funcionais',
        bg: 'bg-blue-50',
      },
      {
        key: 'reviewSort',
        emoji: '↕️',
        name: 'Ordenação',
        desc: 'Opções de ordenação das avaliações',
        bg: 'bg-cyan-50',
      },
      {
        key: 'reviewPhotos',
        emoji: '📸',
        name: 'Fotos de clientes',
        desc: 'Feature de fotos nas avaliações',
        bg: 'bg-sky-50',
      },
      {
        key: 'reviewRecommendation',
        emoji: '👍',
        name: 'Recomendação',
        desc: 'Chip "recomenda o produto" visível',
        bg: 'bg-green-50',
      },
      {
        key: 'rating',
        emoji: '🌟',
        name: 'Nota (rating)',
        desc: 'Estrelas e nota média visíveis',
        bg: 'bg-orange-50',
      },
      {
        key: 'ratingConsistency',
        emoji: '🔗',
        name: 'Consistência da nota',
        desc: 'Nota da tela bate com a API de reviews',
        bg: 'bg-red-50',
      },
    ],
  },
  {
    title: 'Vitrines de Produtos',
    items: [
      {
        key: 'brandShowcase',
        emoji: '🏷️',
        name: 'Mais da marca',
        desc: 'Vitrine "mais produtos da marca"',
        bg: 'bg-lime-50',
      },
      {
        key: 'recommendationShowcase',
        emoji: '✨',
        name: 'Recomendados',
        desc: 'Vitrine "achamos que você vai gostar"',
        bg: 'bg-teal-50',
      },
      {
        key: 'shopTheSet',
        emoji: '🛍️',
        name: 'Shop the Set',
        desc: 'Combo de produtos comprados juntos',
        bg: 'bg-indigo-50',
      },
    ],
  },
  {
    title: 'Compra',
    items: [
      //   {
      //     key: 'pricing',
      //     emoji: '💲',
      //     name: 'Preço e desconto',
      //     desc: 'Preço de venda/lista exibidos corretamente',
      //     bg: 'bg-rose-50',
      //   },
      //   {
      //     key: 'shipping',
      //     emoji: '🚚',
      //     name: 'Frete',
      //     desc: 'Simulação de frete por CEP funcional',
      //     bg: 'bg-slate-50',
      //   },
      {
        key: 'addToCart',
        emoji: '🛒',
        name: 'Adicionar à sacola',
        desc: 'Botão de compra visível e habilitado',
        bg: 'bg-fuchsia-50',
      },
      {
        key: 'favoriteButton',
        emoji: '❤️',
        name: 'Favoritos',
        desc: 'Funcionalidade de wishlist presente',
        bg: 'bg-pink-50',
      },
      {
        key: 'productVariations',
        emoji: '🎨',
        name: 'Variações',
        desc: 'Seletores de cor/tamanho funcionais',
        bg: 'bg-emerald-50',
      },
    ],
  },
  {
    title: 'Conteúdo & Mídia',
    items: [
      {
        key: 'images',
        emoji: '🖼️',
        name: 'Imagens do produto',
        desc: 'Carrossel de imagens carregado',
        bg: 'bg-violet-50',
      },
      {
        key: 'contentBanners',
        emoji: '🧩',
        name: 'Banners de conteúdo',
        desc: 'Detecta imagens quebradas (404)',
        bg: 'bg-amber-50',
      },
    ],
  },
];

export const TOTAL_CHECKS = CHECKS_CATALOG.reduce((n, c) => n + c.items.length, 0);

export const ALL_CHECKLIST_ITEMS: ChecklistItem[] = CHECKS_CATALOG.flatMap((c) => c.items);
