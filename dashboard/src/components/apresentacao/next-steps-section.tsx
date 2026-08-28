import { cn } from '@/lib/utils';

const NEXT_STEPS = [
  {
    number: '01',
    title: 'Expandir Cobertura',
    description: 'Adicionar novos tipos de verificação e cobrir mais SKUs por operação.',
    accent: 'border-t-indigo-500',
  },
  {
    number: '02',
    title: 'Alertas em Tempo Real',
    description: 'Integrar notificações automáticas via Slack ou e-mail ao detectar regressões.',
    accent: 'border-t-emerald-500',
  },
  {
    number: '03',
    title: 'Integração com CI/CD',
    description: 'Executar checks automaticamente a cada deploy para prevenir regressões.',
    accent: 'border-t-purple-500',
  },
];

interface NextStepCardProps {
  number: string;
  title: string;
  description: string;
  accent: string;
}

function NextStepCard({ number, title, description, accent }: NextStepCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-gray-100 bg-white p-6 shadow-sm',
        'border-t-4',
        accent,
      )}
    >
      <span className="mb-3 block font-mono text-xs font-bold text-gray-300">{number}</span>
      <h3 className="mb-2 font-bold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
  );
}

export function NextStepsSection() {
  return (
    <section aria-labelledby="nextsteps-heading">
      <div className="mb-6">
        <h2 id="nextsteps-heading" className="text-2xl font-bold text-gray-900">
          Próximos Passos
        </h2>
        <p className="mt-1 text-sm text-gray-500">Evolução planejada da automação</p>
      </div>
      <div className="grid gap-4md:grid-cols-3">
        {NEXT_STEPS.map((step) => (
          <NextStepCard key={step.number} {...step} />
        ))}
      </div>
    </section>
  );
}
