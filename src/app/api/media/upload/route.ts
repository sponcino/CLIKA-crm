import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { uploadMedia } from '@/lib/meta/client';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspaceId') as string | null;

    if (!file || !workspaceId) {
      return new NextResponse('Missing file or workspaceId', { status: 400 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });

    if (!membership) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { workspaceId },
    });

    if (!config || !config.encryptedAccessToken || !config.phoneNumberId) {
      return new NextResponse('WhatsApp Config not found or incomplete', { status: 400 });
    }

    const accessToken = decrypt(config.encryptedAccessToken);

    const result = await uploadMedia(config.phoneNumberId, accessToken, file);

    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('audio/')) type = 'audio';
    else if (file.type.startsWith('video/')) type = 'video';

    return NextResponse.json({ mediaId: result.id, type });
  } catch (error) {
    console.error('Error uploading media:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
