import {
  Target,
  Clock,
  Users,
  TrendingUp,
  Mail,
  UploadCloud,
  Database,
  type LucideIcon,
} from 'lucide-react';

/** Static presentation content — separate from render logic so it can be updated without touching JSX. */

/** Vendor display labels — shared by CoverageSection and ErrorMatrixSection. */
export const VENDOR_LABELS: Record<string, { label: string; className: string }> = {
  natura: { label: 'Natura', className: 'bg-primary-wash text-primary-darkest' },
  avon: { label: 'Avon', className: 'bg-pink-100 text-pink-800' },
};

export interface HighlightContent {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  description: string;
}

/** Everything good about the automation in one place — value delivered + capabilities already live. */
export const HIGHLIGHTS: HighlightContent[] = [
  {
    icon: Target,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Detecção Proativa',
    description:
      'Identifica falhas em features críticas antes que impactem a experiência do cliente, reduzindo o tempo de exposição a problemas.',
  },
  {
    icon: Users,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Visibilidade',
    description:
      'Relatórios centralizados permitem o acompanhamento do status das features de suasrespectivas operações.',
  },
  {
    icon: TrendingUp,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Rastreabilidade de Evolução',
    description:
      'Histórico completo de execuções permite identificar tendências, regressões e melhorias ao longo do tempo.',
  },
  {
    icon: Clock,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Execução Diária Automática',
    description: 'Roda todo dia via GitHub Actions (cron), sem intervenção manual.',
  },
  {
    icon: Mail,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Alertas por E-mail',
    description: 'E-mail automático quando um check falha, com link do workflow e resumo.',
  },
  {
    icon: UploadCloud,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Publicação Automática do Relatório',
    description: 'Cada execução publica o relatório atualizado no GitHub Pages.',
  },
  {
    icon: Database,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Gestão de SKUs via Dashboard',
    description: 'Novos SKUs podem ser cadastrados pelo SKU Manager, sem alterar código.',
  },
];

export interface NextStepContent {
  number: string;
  title: string;
  description: string;
  accent: string;
}

export const NEXT_STEPS: NextStepContent[] = [
  {
    number: '01',
    title: 'Expandir Cobertura',
    description: 'Adicionar novos tipos de verificação e cobrir mais operações/países.',
    accent: 'border-t-primary',
  },
  {
    number: '02',
    title: 'Alertas em Tempo Real',
    description:
      'Permitir cadastrar destinatários pelo próprio dashboard, sem depender de secret do GitHub.',
    accent: 'border-t-success',
  },
  {
    number: '03',
    title: 'Integração com CI/CD',
    description:
      'Disparar a execução a cada deploy do site das operações, não apenas por agenda diária.',
    accent: 'border-t-info',
  },
];
