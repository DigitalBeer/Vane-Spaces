import db from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) return NextResponse.json({ message: 'Space not found' }, { status: 404 });
    return NextResponse.json({ pinnedQueries: space.pinnedQueries ?? [] });
  } catch (err) {
    console.error('Error fetching space:', err);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const raw: unknown[] = Array.isArray(body.pinnedQueries)
      ? body.pinnedQueries
      : [];
    const sanitized: string[] = raw
      .map((v: unknown) => String(v).trim())
      .filter((s: string) => s.length > 0)
      .reduce((acc: string[], curr: string) => {
        if (!acc.includes(curr)) acc.push(curr.slice(0, 300));
        return acc;
      }, [] as string[]);

    if (sanitized.length > 20) sanitized.length = 20;

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) return NextResponse.json({ message: 'Space not found' }, { status: 404 });

    await db.update(spaces).set({ pinnedQueries: sanitized, updatedAt: new Date().toISOString() }).where(eq(spaces.id, id));
    return NextResponse.json({ pinnedQueries: sanitized });
  } catch (err) {
    console.error('Error updating space pinned queries:', err);
    return NextResponse.json({ message: 'Error' }, { status: 500 });
  }
}
