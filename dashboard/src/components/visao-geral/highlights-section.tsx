import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';
import { HIGHLIGHTS } from './content';

interface HighlightCardProps {
  icon: LucideIcon;
  color: string;
  bg: string;
  title: string;
  description: string;
}

function HighlightCard({ icon: Icon, color, bg, title, description }: HighlightCardProps) {
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

export function HighlightsSection() {
  return (
    <section aria-labelledby="highlights-heading">
      <div className="mb-6">
        <h2 id="highlights-heading" className="text-2xl font-bold text-gray-900">
          O que a automação faz
        </h2>
        <p className="mt-1 text-sm text-gray-500">Em produção hoje</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {HIGHLIGHTS.map((card) => (
          <HighlightCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
