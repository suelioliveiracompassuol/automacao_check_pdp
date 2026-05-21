// =============================================================================
// FEATURES TO CHECK
// =============================================================================

import { FeatureConfig } from "../../types";

export const FEATURES: FeatureConfig[] = [
  {
    key: "reviews",
    name: "Avaliações do produto",
  },
  {
    key: "aiReviewSummary",
    name: "Resumo de avaliações por IA",
    optional: true,
  },
  { key: "reviewFilter", name: "Filtro de avaliações" },
  { key: "reviewSort", name: "Ordenação de avaliações" },
  { key: "reviewPhotos", name: "Fotos nas avaliações" },
  { key: "reviewRecommendation", name: "Recomendação de avaliações" },
  { key: "brandShowcase", name: 'Vitrine "Mais produtos da marca"' },
  {
    key: "recommendationShowcase",
    name: 'Vitrine "Achamos que você vai gostar"',
  },
  {
    key: "shopTheSet",
    name: 'Shop the Set ("Queridinhos comprados juntos")',
    optional: true,
  },
  { key: "images", name: "Imagens do produto" },
  { key: "pricing", name: "Preço e desconto" },
  { key: "shipping", name: "Simulação de frete" },
  { key: "rating", name: "Nota/Rating" },
  { key: "ratingConsistency", name: "Consistência da Nota (Rating)" },
];
