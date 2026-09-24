import { Card, SectionHeader } from '@/components/ui/card';
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
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', bg)}>
        <Icon className={cn('h-5 w-5', color)} />
      </div>
      <div>
        <h3 className="mb-1 font-bold text-highlight">{title}</h3>
        <p className="text-sm leading-relaxed text-medium-emphasis">{description}</p>
      </div>
    </Card>
  );
}

export function HighlightsSection() {
  return (
    <section aria-labelledby="highlights-heading">
      <SectionHeader
        id="highlights-heading"
        eyebrow="Sobre"
        title="O que a automação faz"
        description="Em produção hoje"
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {HIGHLIGHTS.map((card) => (
          <HighlightCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
