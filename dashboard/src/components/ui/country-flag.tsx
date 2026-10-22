import Image from 'next/image';
import { cn, getCountryFlag } from '@/lib/utils';

interface CountryFlagProps {
  code: string;
  width: number;
  height: number;
  /** Vazio por padrão: na maioria dos usos o código do país já aparece ao lado. */
  alt?: string;
  className?: string;
}

/** Bandeira (flagcdn) com dimensões explícitas — evita layout shift e carrega sob demanda. */
export function CountryFlag({ code, width, height, alt = '', className }: CountryFlagProps) {
  return (
    <Image
      src={getCountryFlag(code)}
      alt={alt}
      width={width}
      height={height}
      // PNG minúsculo de CDN externo num export estático: não há o que otimizar.
      unoptimized
      className={cn('rounded-sm object-cover', className)}
    />
  );
}
