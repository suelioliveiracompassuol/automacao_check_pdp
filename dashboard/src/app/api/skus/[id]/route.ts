import { NextResponse } from 'next/server';
import { deleteSku, updateSku } from '@/lib/sku-data';
import type { SkuEntry } from '@/lib/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<Omit<SkuEntry, 'id'>>;
    const updated = updateSku(id, body);
    if (updated === null) {
      return NextResponse.json({ error: 'SKU não encontrado' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Falha ao atualizar SKU' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = deleteSku(id);
    if (!deleted) {
      return NextResponse.json({ error: 'SKU não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Falha ao excluir SKU' }, { status: 500 });
  }
}
