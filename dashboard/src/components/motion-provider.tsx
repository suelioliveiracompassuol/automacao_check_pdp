'use client';

import { LazyMotion, MotionConfig } from 'framer-motion';

const loadFeatures = () => import('./motion-features').then((mod) => mod.default);

/** Animações do framer-motion com features carregadas sob demanda (fora do bundle inicial) e
 * respeitando a preferência "reduzir movimento" do sistema. `strict` impede usar `motion.*`,
 * que traria o pacote completo de volta — use `m.*`. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
