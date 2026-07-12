import db from '@/lib/db';
import { spaces, digestTopics } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async (req: Request) => {
  try {
    let chats = await db.query.chats.findMany();
    chats = chats.reverse();

    const spaceIds = [...new Set(chats.map((c) => c.spaceId).filter(Boolean))] as string[];
    const spaceRows = spaceIds.length > 0
      ? await Promise.all(
          spaceIds.map((id) =>
            db.query.spaces.findFirst({ where: eq(spaces.id, id) }),
          ),
        )
      : [];

    const spaceMap = new Map(
      spaceRows.filter(Boolean).map((s) => [s!.id, { id: s!.id, name: s!.name, icon: s!.icon }]),
    );

    const digestIds = [...new Set(chats.map((c) => c.digestId).filter(Boolean))] as string[];
    const digestRows = digestIds.length > 0
      ? await Promise.all(
          digestIds.map((id) =>
            db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) }),
          ),
        )
      : [];

    const digestMap = new Map(
      digestRows.filter(Boolean).map((d) => [d!.id, { id: d!.id, name: d!.name }]),
    );

    const enriched = chats.map((c) => ({
      ...c,
      space: c.spaceId ? spaceMap.get(c.spaceId) ?? null : null,
      digest: c.digestId ? digestMap.get(c.digestId) ?? null : null,
    }));

    return Response.json({ chats: enriched }, { status: 200 });
  } catch (err) {
    console.error('Error in getting chats: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};
