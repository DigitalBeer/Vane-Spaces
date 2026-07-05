import db from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { searchSpaceMessages } from '@/lib/db/messagesFts';

export const GET = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();

    const spaceExists = await db.query.spaces.findFirst({
      where: eq(spaces.id, id),
    });

    if (!spaceExists) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    if (!q) {
      return Response.json({ results: [] }, { status: 200 });
    }

    const results = searchSpaceMessages(id, q, 50);

    return Response.json({ results }, { status: 200 });
  } catch (err) {
    console.error('Error searching space messages:', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
