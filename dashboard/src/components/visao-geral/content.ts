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
      'Relatórios centralizados permitem o acompanhamento do status das features de suas respectivas operações.',
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
    description: 'Cada execução publica o relatório atualizado.',
  },
  {
    icon: Database,
    color: 'text-primary-dark',
    bg: 'bg-primary-wash',
    title: 'Gestão de SKUs via Dashboard',
    description: 'Novos SKUs podem ser cadastrados pelo SKU Manager, sem alterar via código.',
  },
];
