import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Target, Clock, Users, TrendingUp, type LucideIcon } from 'lucide-react';

const IMPACT_CARDS = [
  {
    icon: Target,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    title: 'Detecção Proativa',
    description:
      'Identifica falhas em features críticas antes que impactem a experiência do cliente, reduzindo o tempo de exposição a problemas.',
  },
  {
    icon: Clock,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    title: 'Cobertura Contínua',
    description:
      'Execução automatizada diária garante monitoramento constante sem esforço manual, cobrindo todos os países e marcas simultaneamente.',
  },
  {
    icon: Users,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    title: 'Visibilidade Cross-Squad',
    description:
      'Relatórios centralizados permitem que diferentes squads acompanhem o status das features de suas respectivas operações.',
  },
  {
    icon: TrendingUp,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    title: 'Rastreabilidade de Evolução',
    description:
      'Histórico completo de execuções permite identificar tendências, regressões e melhorias ao longo do tempo.',
  },
];

interface ImpactCardProps {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  description: string;
}

function ImpactCard({ icon: Icon, color, bg, title, description }: ImpactCardProps) {
  return (
    <Card className="flex gap-4">
      <div className={cn('h-fit shrink-0 rounded-xl p-3', bg)}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-gray-900">{title}</h3>
        <p className="text-sm leading-relaxed text-gray-500">{description}</p>
      </div>
    </Card>
  );
}

export function ImpactSection() {
  return (
    <section aria-labelledby="impact-heading">
      <div className="mb-6">
        <h2 id="impact-heading" className="text-2xl font-bold text-gray-900">
          Impacto de Negócio
        </h2>
        <p className="mt-1 text-sm text-gray-500">Como a automação gera valor para as operações</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {IMPACT_CARDS.map((card) => (
          <ImpactCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
