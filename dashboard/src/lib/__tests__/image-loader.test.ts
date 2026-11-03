import { describe, it, expect } from 'vitest';
import imageLoader, { sfccImageUrl } from '../image-loader';

const ORIGINAL =
  'https://production.na01.natura.com/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/dwdaed079e/Produtos/NATBRA-226559_1.jpg';

describe('image-loader', () => {
  it('manda a imagem do SFCC para o redimensionamento da loja, na largura pedida', () => {
    expect(imageLoader({ src: ORIGINAL, width: 96 })).toBe(
      'https://production.na01.natura.com/dw/image/v2/BFKR_PRD/on/demandware.static/-/Sites-natura-br-storefront-catalog/default/dwdaed079e/Produtos/NATBRA-226559_1.jpg?sw=96&q=75',
    );
    expect(sfccImageUrl(ORIGINAL, 48, 60)).toMatch(/\?sw=48&q=60$/);
  });

  it('devolve outras imagens como estão', () => {
    expect(imageLoader({ src: '/feature-refs/natura-br/reviews.png', width: 96 })).toBe(
      '/feature-refs/natura-br/reviews.png',
    );
    expect(imageLoader({ src: 'https://flagcdn.com/w40/br.png', width: 40 })).toBe(
      'https://flagcdn.com/w40/br.png',
    );
    expect(sfccImageUrl('não é url', 48)).toBeNull();
  });
});
