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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const doc = await prisma.knowledgeDocument.findUnique({
    where: { id: params.id },
    include: { chunks: { select: { id: true, content: true }, orderBy: { createdAt: 'asc' } } },
  });

  if (!doc) return new NextResponse('Not Found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: doc.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  // Check which chunks have embeddings via raw query
  interface EmbedRow { id: string }
  const embeddedChunks = await prisma.$queryRaw<EmbedRow[]>`
    SELECT id FROM "KnowledgeChunk"
    WHERE "documentId" = ${params.id} AND embedding IS NOT NULL
  `.catch(() => [] as EmbedRow[]);

  const embeddedIds = new Set(embeddedChunks.map((r) => r.id));

  return NextResponse.json({
    ...doc,
    chunks: doc.chunks.map((c) => ({
      id: c.id,
      content: c.content,
      hasEmbedding: embeddedIds.has(c.id),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { title, content, category, isActive } = body;

    const doc = await prisma.knowledgeDocument.findUnique({ where: { id: params.id } });
    if (!doc) return new NextResponse('Not Found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: doc.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    // Re-chunk and re-embed if content changed
    if (content !== undefined && content !== doc.content) {
      await prisma.knowledgeChunk.deleteMany({ where: { documentId: params.id } });
      const chunkTexts = chunkContent(content);
      const embeddings = await generateEmbeddings(chunkTexts);

      await prisma.knowledgeChunk.createMany({
        data: chunkTexts.map((c) => ({ documentId: params.id, content: c })),
      });

      if (embeddings.some((e) => e.length > 0)) {
        const newChunks = await prisma.knowledgeChunk.findMany({
          where: { documentId: params.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        for (let i = 0; i < newChunks.length; i++) {
          const emb = embeddings[i];
          if (!emb || emb.length === 0) continue;
          await prisma.$executeRawUnsafe(
            `UPDATE "KnowledgeChunk" SET embedding = $1::vector WHERE id = $2`,
            `[${emb.join(',')}]`,
            newChunks[i].id
          );
        }
      }
    }

    const updated = await prisma.knowledgeDocument.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { _count: { select: { chunks: true } } },
    });

    return NextResponse.json({ ...updated, chunkCount: updated._count.chunks });
  } catch (error) {
    console.error('Error updating knowledge document:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const doc = await prisma.knowledgeDocument.findUnique({ where: { id: params.id } });
  if (!doc) return new NextResponse('Not Found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: doc.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  await prisma.knowledgeDocument.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
