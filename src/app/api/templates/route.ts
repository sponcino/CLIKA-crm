import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

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

  const templates = await prisma.whatsAppTemplate.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const config = await prisma.whatsAppConfig.findFirst({
      where: { workspaceId },
    });

    if (!config || !config.encryptedAccessToken || !config.wabaId) {
      return NextResponse.json(
        { error: 'Meta WhatsApp is not configured for this workspace' },
        { status: 400 }
      );
    }

    const accessToken = decrypt(config.encryptedAccessToken);
    const wabaId = config.wabaId;

    // Fetch from Meta Graph API
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${wabaId}/message_templates?limit=100`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch templates from Meta' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const metaTemplates = data.data || [];

    let syncCount = 0;

    for (const temp of metaTemplates) {
      // Find full text representation from components
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bodyComponent = temp.components?.find((c: any) => c.type === 'BODY');
      const content = bodyComponent?.text || temp.name;

      // Upsert into local database
      await prisma.whatsAppTemplate.upsert({
        where: {
          id: temp.id || `${workspaceId}_${temp.name}`, // Fallback if no Meta ID provided
        },
        update: {
          name: temp.name,
          content,
          status: temp.status || 'APPROVED',
        },
        create: {
          id: temp.id || `${workspaceId}_${temp.name}`,
          workspaceId,
          name: temp.name,
          content,
          status: temp.status || 'APPROVED',
        },
      });

      syncCount++;
    }

    return NextResponse.json({ success: true, count: syncCount });
  } catch (error) {
    console.error('Error syncing templates:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
