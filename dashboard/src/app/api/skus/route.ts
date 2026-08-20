import { NextResponse } from 'next/server';
import { createSku, readSkus } from '@/lib/sku-data';
import type { SkuEntry } from '@/lib/types';

export async function GET() {
  try {
    const skus = readSkus();
    return NextResponse.json(skus);
  } catch {
    return NextResponse.json({ error: 'Falha ao ler SKUs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Omit<SkuEntry, 'id'>;
    const newSku = createSku(body);
    return NextResponse.json(newSku, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Falha ao criar SKU' }, { status: 500 });
  }
}
