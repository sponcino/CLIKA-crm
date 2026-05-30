import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const qWorkspaceId = searchParams.get('workspaceId');

  // Resolve workspaceId
  let workspaceId = qWorkspaceId;
  if (!workspaceId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    workspaceId = membership?.workspaceId ?? null;
  }
  if (!workspaceId) return NextResponse.json({ success: false, error: 'No workspace found' });

  // Auth check
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const config = await prisma.whatsAppConfig.findUnique({ where: { workspaceId } });

  if (!config || !config.encryptedAccessToken || !config.phoneNumberId) {
    return NextResponse.json({
      success: false,
      error: 'WhatsApp no está configurado. Guarda la configuración primero.',
    });
  }

  try {
    const accessToken = decrypt(config.encryptedAccessToken);

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${config.phoneNumberId}?fields=display_phone_number,verified_name&access_token=${accessToken}`,
      { cache: 'no-store' }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return NextResponse.json({
        success: false,
        error: data.error?.message ?? 'Error al conectar con Meta Graph API',
      });
    }

    // Update connectionStatus and lastConnectionCheckAt
    await prisma.whatsAppConfig.update({
      where: { workspaceId },
      data: {
        connectionStatus: 'CONNECTED',
        lastConnectionCheckAt: new Date(),
        displayPhoneNumber: data.display_phone_number ?? config.displayPhoneNumber,
      },
    });

    return NextResponse.json({
      success: true,
      displayName: data.verified_name ?? '',
      phoneNumber: data.display_phone_number ?? '',
    });
  } catch (error) {
    console.error('WhatsApp connection test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno al probar la conexión',
    });
  }
}
