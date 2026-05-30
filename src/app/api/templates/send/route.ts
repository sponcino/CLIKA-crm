import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { sendTemplate } from '@/lib/meta/client';

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

  const logs = await prisma.templateSendLog.findMany({
    where: {
      template: {
        workspaceId,
      },
    },
    include: {
      template: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const contacts = await prisma.contact.findMany({
    where: { workspaceId },
  });

  const logsWithContacts = logs.map((log) => {
    const contact = contacts.find((c) => c.id === log.contactId);
    return {
      ...log,
      contact: contact
        ? {
            whatsappPhone: contact.whatsappPhone,
            whatsappName: contact.whatsappName,
            fullName: contact.fullName,
          }
        : {
            whatsappPhone: 'Unknown',
          },
    };
  });

  return NextResponse.json(logsWithContacts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { templateId, contactId, variables } = body;

    if (!templateId || !contactId) {
      return new NextResponse('Missing templateId or contactId', { status: 400 });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: templateId },
    });
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!template || !contact) {
      return new NextResponse('Template or Contact not found', { status: 404 });
    }

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: template.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const config = await prisma.whatsAppConfig.findFirst({
      where: { workspaceId: template.workspaceId },
    });

    if (!config || !config.encryptedAccessToken || !config.phoneNumberId) {
      return NextResponse.json(
        { error: 'Meta WhatsApp is not configured for this workspace' },
        { status: 400 }
      );
    }

    const accessToken = decrypt(config.encryptedAccessToken);
    const phoneNumberId = config.phoneNumberId;

    // Build components parameter from variables
    const vars = variables || {};
    const parameters = Object.keys(vars)
      .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
      .map((key) => ({
        type: 'text',
        text: String(vars[key]),
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const components: any[] = parameters.length > 0 ? [{
      type: 'body',
      parameters,
    }] : [];

    let sendLogStatus = 'SENT';
    let errorMessage = null;

    try {
      await sendTemplate(
        phoneNumberId,
        accessToken,
        contact.whatsappPhone,
        template.name,
        'es', // Default language code, or we can customize
        components
      );
    } catch (err: unknown) {
      console.error('Meta template send failed:', err);
      sendLogStatus = 'FAILED';
      errorMessage = err instanceof Error ? err.message : String(err);
    }

    // Save logs
    const log = await prisma.templateSendLog.create({
      data: {
        templateId,
        contactId,
        status: sendLogStatus,
        error: errorMessage ? errorMessage.substring(0, 500) : null,
      },
    });

    if (sendLogStatus === 'FAILED') {
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }

    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Error sending template:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
