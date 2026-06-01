import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any).workspaceId;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'fullName',
      'whatsappPhone',
      'email',
      'company',
      'businessType',
      'status',
      'leadScore',
      'leadSource',
      'campaignId',
      'adId',
      'createdAt',
      'lastMessageAt',
    ];

    const rows = contacts.map((c) => [
      escapeCSV(c.fullName || c.whatsappName),
      escapeCSV(c.whatsappPhone),
      escapeCSV(c.email),
      escapeCSV(c.company),
      escapeCSV(c.businessType),
      escapeCSV(c.status),
      escapeCSV(c.leadScore),
      escapeCSV(c.leadSource),
      escapeCSV(c.campaignId),
      escapeCSV(c.adId),
      escapeCSV(c.createdAt.toISOString()),
      escapeCSV(c.lastMessageAt?.toISOString()),
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\r\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="contacts.csv"',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
