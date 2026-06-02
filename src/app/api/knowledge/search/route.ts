import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { generateEmbedding } from '@/lib/ai/embeddings';

interface VectorRow {
  id: string;
  content: string;
  document_id: string;
  document_title: string;
  category: string;
  similarity: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, query } = body;

    if (!workspaceId || !query) {
      return new NextResponse('Missing workspaceId or query', { status: 400 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    // Try vector search first
    const queryEmbedding = await generateEmbedding(query);

    if (queryEmbedding.length > 0) {
      try {
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        const rows = await prisma.$queryRawUnsafe<VectorRow[]>(
          `
          SELECT
            kc.id,
            kc.content,
            kd.id            AS document_id,
            kd.title         AS document_title,
            kd.category,
            1 - (kc.embedding <=> $1::vector) AS similarity
          FROM "KnowledgeChunk" kc
          JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
          WHERE kd."workspaceId" = $2
            AND kd."isActive" = true
            AND kc.embedding IS NOT NULL
          ORDER BY kc.embedding <=> $1::vector
          LIMIT 5
          `,
          vectorStr,
          workspaceId
        );

        if (rows.length > 0) {
          return NextResponse.json(
            rows.map((r) => ({
              chunkId: r.id,
              documentId: r.document_id,
              documentTitle: r.document_title,
              category: r.category,
              content: r.content,
              score: Math.round(r.similarity * 100),
              similarity: r.similarity,
              searchType: 'vector',
            }))
          );
        }
        // Fall through to text search if no embedded chunks found
      } catch (pgErr) {
        // pgvector not installed or other SQL error — fall through to text search
        console.warn('[knowledge/search] vector search unavailable, falling back to text:', pgErr);
      }
    }

    // Text search fallback
    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        content: { contains: query, mode: 'insensitive' },
        document: { workspaceId, isActive: true },
      },
      include: {
        document: { select: { id: true, title: true, category: true } },
      },
      take: 20,
    });

    const scored = chunks.map((chunk) => {
      const pos = chunk.content.toLowerCase().indexOf(query.toLowerCase());
      const similarity = pos === -1 ? 0 : Math.max(0, 1 - pos / chunk.content.length);
      return {
        chunkId: chunk.id,
        documentId: chunk.document.id,
        documentTitle: chunk.document.title,
        category: chunk.document.category,
        content: chunk.content,
        score: Math.round(similarity * 100),
        similarity,
        searchType: 'text',
      };
    });

    return NextResponse.json(
      scored.sort((a, b) => b.score - a.score).slice(0, 5)
    );
  } catch (error) {
    console.error('Knowledge search error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
