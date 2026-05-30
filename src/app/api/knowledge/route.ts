import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// Chunk content by paragraphs first, then by char limit with overlap
function chunkContent(content: string, maxChars = 500, overlap = 50): string[] {
  const paragraphs = content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      // Merge with previous chunk if it fits
      if (chunks.length > 0 && chunks[chunks.length - 1].length + para.length + 2 <= maxChars) {
        chunks[chunks.length - 1] += '\n\n' + para;
      } else {
        chunks.push(para);
      }
    } else {
      // Split long paragraph by char limit with overlap
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

  return NextResponse.json(
    docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      isActive: d.isActive,
      createdAt: d.createdAt,
      chunkCount: d._count.chunks,
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

    const chunks = chunkContent(content);

    const doc = await prisma.knowledgeDocument.create({
      data: {
        workspaceId,
        title,
        content,
        category: category || 'General',
        chunks: {
          create: chunks.map((c) => ({ content: c })),
        },
      },
      include: { _count: { select: { chunks: true } } },
    });

    return NextResponse.json({ ...doc, chunkCount: doc._count.chunks });
  } catch (error) {
    console.error('Error creating knowledge document:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
