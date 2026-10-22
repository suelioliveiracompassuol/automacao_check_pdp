import { domMax } from 'framer-motion';

// Pacote de features carregado sob demanda pelo MotionProvider. domMax (e não domAnimation)
// porque o indicador das Tabs usa animação de layout compartilhada (layoutId).
export default domMax;
