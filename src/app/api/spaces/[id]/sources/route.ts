import db, { sqlite as rawDb } from '@/lib/db';
import { spaces } from '@/lib/db/schema';
import { SpaceWebSource } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import UploadManager from '@/lib/uploads/manager';
import Scraper from '@/lib/scraper';
import { splitText } from '@/lib/utils/splitText';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const BACKGROUND_TASK_TIMEOUT_MS = 60_000;

function getSources(spaceId: string): SpaceWebSource[] {
  const row = rawDb.prepare('SELECT webSources FROM spaces WHERE id = ?').get(spaceId) as { webSources: string } | undefined;
  if (!row) throw new Error('Space not found');
  return JSON.parse(row.webSources || '[]');
}

function updateSource(spaceId: string, sourceId: string, patch: Partial<SpaceWebSource>) {
  const updateTx = rawDb.transaction(() => {
    const current = getSources(spaceId);
    const updated = current.map((s) => (s.id === sourceId ? { ...s, ...patch } : s));
    rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
      JSON.stringify(updated),
      new Date().toISOString(),
      spaceId,
    );
    return updated;
  });
  return updateTx();
}

// The latest scrape attempt per source. A timed-out, refreshed or deleted
// source drops/replaces its entry, so a stale attempt that finishes later
// writes nothing instead of overwriting newer state.
const activeAttempts = new Map<string, string>();

function startScrape(
  spaceId: string,
  sourceId: string,
  url: string,
  embeddingModelProviderId: string,
  embeddingModelKey: string,
) {
  const attemptId = crypto.randomUUID();
  activeAttempts.set(sourceId, attemptId);
  const isCurrent = () => activeAttempts.get(sourceId) === attemptId;

  const timer = setTimeout(() => {
    if (!isCurrent()) return;
    activeAttempts.delete(sourceId);
    updateSource(spaceId, sourceId, {
      status: 'failed',
      error: `Scrape+embed timed out after ${BACKGROUND_TASK_TIMEOUT_MS / 1000}s`,
    });
  }, BACKGROUND_TASK_TIMEOUT_MS);

  scrapeAndEmbed(spaceId, sourceId, url, embeddingModelProviderId, embeddingModelKey, isCurrent)
    .catch((err: any) => {
      if (!isCurrent()) return;
      updateSource(spaceId, sourceId, {
        status: 'failed',
        error: err?.message || 'Unknown error',
      });
    })
    .finally(() => {
      clearTimeout(timer);
      if (isCurrent()) activeAttempts.delete(sourceId);
    });
}

async function scrapeAndEmbed(
  spaceId: string,
  sourceId: string,
  url: string,
  embeddingModelProviderId: string,
  embeddingModelKey: string,
  isCurrent: () => boolean,
): Promise<void> {
  const registry = new ModelRegistry();
  const embeddingModel = await registry.loadEmbeddingModel(embeddingModelProviderId, embeddingModelKey);

  const { content, title } = await Scraper.scrape(url);

  const chunks = splitText(content, 512, 128);
  if (chunks.length === 0) throw new Error('No content extracted from URL');

  const embeddings = await embeddingModel.embedText(chunks);
  if (embeddings.length !== chunks.length) throw new Error('Embedding count mismatch');

  // Everything below is synchronous, so the attempt cannot be superseded
  // between this check and the final status write.
  if (!isCurrent()) return;

  if (!fs.existsSync(UploadManager.uploadsDir)) {
    fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });
  }

  const fileId = crypto.randomBytes(16).toString('hex');
  const contentPath = path.join(UploadManager.uploadsDir, `${fileId}.content.json`);

  fs.writeFileSync(contentPath, JSON.stringify({
    chunks: chunks.map((c, i) => ({ content: c, embedding: embeddings[i] })),
  }, null, 2));

  const recordPath = UploadManager.uploadedFilesRecordPath;
  const recordData = fs.existsSync(recordPath)
    ? JSON.parse(fs.readFileSync(recordPath, 'utf-8'))
    : { files: [] };

  recordData.files.push({
    id: fileId,
    name: title || url,
    filePath: contentPath,
    contentPath,
    uploadedAt: new Date().toISOString(),
  });

  fs.writeFileSync(recordPath, JSON.stringify(recordData, null, 2));

  const previous = getSources(spaceId).find((s) => s.id === sourceId);
  if (!previous) {
    // Source was removed while we worked; don't leave its embeddings behind.
    UploadManager.removeFile(fileId);
    return;
  }
  updateSource(spaceId, sourceId, { status: 'ready', fileId, title: title || url, error: null });
  if (previous.fileId && previous.fileId !== fileId) {
    UploadManager.removeFile(previous.fileId);
  }
}

export const POST = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const body = await req.json();
    const { url, embeddingModelKey, embeddingModelProviderId } = body;

    if (!embeddingModelKey || !embeddingModelProviderId) {
      return Response.json(
        { message: 'Embedding model is not configured. Please configure it in Settings before adding sources.' },
        { status: 400 },
      );
    }

    if (!url?.trim()) {
      return Response.json({ message: 'URL is required.' }, { status: 400 });
    }

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const sourceId = crypto.randomBytes(16).toString('hex');
    const newSource: SpaceWebSource = {
      id: sourceId,
      url: url.trim(),
      title: url.trim(),
      fileId: null,
      status: 'pending',
      error: null,
      addedAt: new Date().toISOString(),
    };

    const addSourceTx = rawDb.transaction(() => {
      const current = getSources(id);
      const updated = [...current, newSource];
      rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return updated;
    });
    addSourceTx();

    // Fire-and-forget background task with a hard 60s timeout.
    // Always writes a terminal status (ready/failed) — source never sticks in pending.
    // TODO: future upgrade — replace poll with SSE status event (Vane already streams chat over SSE).
    startScrape(id, sourceId, url.trim(), embeddingModelProviderId, embeddingModelKey);

    return Response.json({ source: newSource }, { status: 202 });
  } catch (err) {
    console.error('Error adding source to space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { sourceId } = await req.json();

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    // Cancel any in-flight scrape so it can't write embeddings for a removed source.
    activeAttempts.delete(sourceId);

    const removeSourceTx = rawDb.transaction(() => {
      const current = getSources(id);
      const removed = current.find((s) => s.id === sourceId);
      const updated = current.filter((s) => s.id !== sourceId);
      rawDb.prepare('UPDATE spaces SET webSources = ?, updatedAt = ? WHERE id = ?').run(
        JSON.stringify(updated),
        new Date().toISOString(),
        id,
      );
      return { updated, removed };
    });

    const { updated: updatedSources, removed } = removeSourceTx();
    if (removed?.fileId) {
      try {
        UploadManager.removeFile(removed.fileId);
      } catch (err) {
        console.error('Failed to remove source embeddings:', err);
      }
    }

    return Response.json({ sources: updatedSources }, { status: 200 });
  } catch (err) {
    console.error('Error removing source from space:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const { sourceId, embeddingModelKey, embeddingModelProviderId } = await req.json();

    if (!embeddingModelKey || !embeddingModelProviderId) {
      return Response.json(
        { message: 'Embedding model is not configured. Please configure it in Settings before refreshing sources.' },
        { status: 400 },
      );
    }

    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, id) });
    if (!space) {
      return Response.json({ message: 'Space not found' }, { status: 404 });
    }

    const sources = getSources(id);
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      return Response.json({ message: 'Source not found' }, { status: 404 });
    }

    updateSource(id, sourceId, { status: 'pending', error: null });

    // Supersedes any attempt still in flight for this source.
    startScrape(id, sourceId, source.url, embeddingModelProviderId, embeddingModelKey);

    return Response.json({ message: 'Refresh started' }, { status: 202 });
  } catch (err) {
    console.error('Error refreshing source:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
