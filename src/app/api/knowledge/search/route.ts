import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

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

    // Text search across active document chunks
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

    // Score by match position (earlier = better) and deduplicate by document
    const scored = chunks.map((chunk) => {
      const pos = chunk.content.toLowerCase().indexOf(query.toLowerCase());
      return {
        chunkId: chunk.id,
        documentId: chunk.document.id,
        documentTitle: chunk.document.title,
        category: chunk.document.category,
        content: chunk.content,
        score: pos === -1 ? 0 : Math.max(0, 100 - pos),
      };
    });

    // Sort by score desc and return top 5
    const results = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Knowledge search error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
