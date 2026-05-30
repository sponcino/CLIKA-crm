import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';

const MASKED = '••••••••';

async function getWorkspaceId(userId: string): Promise<string | null> {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  return membership?.workspaceId ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  // Support optional ?workspaceId= override, else fall back to first membership
  const { searchParams } = new URL(req.url);
  const qWorkspaceId = searchParams.get('workspaceId');
  const workspaceId = qWorkspaceId ?? (await getWorkspaceId(session.user.id));
  if (!workspaceId) return new NextResponse('No workspace', { status: 400 });

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const config = await prisma.whatsAppConfig.findUnique({ where: { workspaceId } });

  if (!config) {
    return NextResponse.json({
      phoneNumberId: '',
      wabaId: '',
      businessId: '',
      displayPhoneNumber: '',
      webhookVerifyToken: '',
      connectionStatus: 'DISCONNECTED',
      accessToken: MASKED,
      appSecret: MASKED,
    });
  }

  return NextResponse.json({
    phoneNumberId: config.phoneNumberId ?? '',
    wabaId: config.wabaId ?? '',
    businessId: config.businessId ?? '',
    displayPhoneNumber: config.displayPhoneNumber ?? '',
    webhookVerifyToken: config.webhookVerifyToken ?? '',
    connectionStatus: config.connectionStatus,
    accessToken: MASKED,
    appSecret: MASKED,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const {
      workspaceId: bodyWorkspaceId,
      phoneNumberId,
      wabaId,
      businessId,
      displayPhoneNumber,
      webhookVerifyToken,
      accessToken,
      appSecret,
    } = body;

    const workspaceId = bodyWorkspaceId ?? (await getWorkspaceId(session.user.id));
    if (!workspaceId) return new NextResponse('No workspace', { status: 400 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    // Only encrypt if a real token was submitted (not the masked placeholder)
    const existingConfig = await prisma.whatsAppConfig.findUnique({ where: { workspaceId } });

    let encryptedAccessToken = existingConfig?.encryptedAccessToken ?? null;
    if (accessToken && accessToken !== MASKED) {
      encryptedAccessToken = encrypt(accessToken);
    }

    // appSecret stored plain (used for webhook signature verification)
    let finalAppSecret = existingConfig?.appSecret ?? null;
    if (appSecret && appSecret !== MASKED) {
      finalAppSecret = appSecret;
    }

    const config = await prisma.whatsAppConfig.upsert({
      where: { workspaceId },
      update: {
        phoneNumberId: phoneNumberId ?? existingConfig?.phoneNumberId,
        wabaId: wabaId ?? existingConfig?.wabaId,
        businessId: businessId ?? existingConfig?.businessId,
        displayPhoneNumber: displayPhoneNumber ?? existingConfig?.displayPhoneNumber,
        webhookVerifyToken: webhookVerifyToken ?? existingConfig?.webhookVerifyToken,
        encryptedAccessToken,
        appSecret: finalAppSecret,
        connectionStatus: 'CONNECTED',
      },
      create: {
        workspaceId,
        phoneNumberId,
        wabaId,
        businessId,
        displayPhoneNumber,
        webhookVerifyToken,
        encryptedAccessToken,
        appSecret: finalAppSecret,
        connectionStatus: 'CONNECTED',
      },
    });

    return NextResponse.json({
      success: true,
      connectionStatus: config.connectionStatus,
    });
  } catch (error) {
    console.error('Error saving WhatsApp config:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
