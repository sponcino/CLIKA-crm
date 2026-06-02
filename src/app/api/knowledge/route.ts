import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { generateEmbeddings } from '@/lib/ai/embeddings';

function chunkContent(content: string, maxChars = 500, overlap = 50): string[] {
  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      if (chunks.length > 0 && chunks[chunks.length - 1].length + para.length + 2 <= maxChars) {
        chunks[chunks.length - 1] += '\n\n' + para;
      } else {
        chunks.push(para);
      }
    } else {
      let start = 0;
      while (start < para.length) {
        const end = Math.min(start + maxChars, para.length);
        chunks.push(para.slice(start, end));
        start += maxChars - overlap;
      }
    }
  }

  return chunks.filter(Boolean);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const docs = await prisma.knowledgeDocument.findMany({
    where: { workspaceId },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Check which documents have at least one embedded chunk (via raw query)
  interface EmbedRow { documentId: string }
  const embeddedRows = await prisma.$queryRaw<EmbedRow[]>`
    SELECT DISTINCT kc."documentId"
    FROM "KnowledgeChunk" kc
    JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
    WHERE kd."workspaceId" = ${workspaceId}
      AND kc.embedding IS NOT NULL
  `.catch(() => [] as EmbedRow[]);

  const embeddedDocIds = new Set(embeddedRows.map((r) => r.documentId));

  return NextResponse.json(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      isActive: d.isActive,
      createdAt: d.createdAt,
      chunkCount: d._count.chunks,
      hasEmbeddings: embeddedDocIds.has(d.id),
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, title, content, category } = body;

    if (!workspaceId || !title || !content) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const chunkTexts = chunkContent(content);

    // Generate embeddings in parallel (gracefully returns [] if no API key)
    const embeddings = await generateEmbeddings(chunkTexts);

    // Create document with chunks
    const doc = await prisma.knowledgeDocument.create({
      data: {
        workspaceId,
        title,
        content,
        category: category || 'General',
        chunks: {
          create: chunkTexts.map((text) => ({ content: text })),
        },
      },
      include: {
        _count: { select: { chunks: true } },
        chunks: { select: { id: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    // Store embeddings via raw SQL (pgvector unsupported type)
    if (embeddings.some((e) => e.length > 0)) {
      for (let i = 0; i < doc.chunks.length; i++) {
        const emb = embeddings[i];
        if (!emb || emb.length === 0) continue;
        await prisma.$executeRawUnsafe(
          `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
          `[${emb.join(',')}]`,
          doc.chunks[i].id
        );
      }
    }

    return NextResponse.json({
      ...doc,
      chunkCount: doc._count.chunks,
      hasEmbeddings: embeddings.some((e) => e.length > 0),
    });
  } catch (error) {
    console.error('Error creating knowledge document:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
