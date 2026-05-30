import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

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
    include: { chunks: true },
  });

  if (!doc) return new NextResponse('Not Found', { status: 404 });

  // Auth check via workspace membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: doc.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  return NextResponse.json(doc);
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

    // If content changed, rechunk
    if (content !== undefined && content !== doc.content) {
      await prisma.knowledgeChunk.deleteMany({ where: { documentId: params.id } });
      const chunks = chunkContent(content);
      await prisma.knowledgeChunk.createMany({
        data: chunks.map((c) => ({ documentId: params.id, content: c })),
      });
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

  // Chunks deleted via cascade
  await prisma.knowledgeDocument.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
