import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

function getPeriodStart(period: string): Date {
  const now = new Date();
  const days = period === '90d' ? 90 : period === '30d' ? 30 : 7;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildDateSeries(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const period = searchParams.get('period') || '30d';

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const periodStart = getPeriodStart(period);
  const now = new Date();

  // Run all queries in parallel
  const [
    totalContacts,
    newContacts,
    totalConversations,
    openConversations,
    closedConversations,
    humanInterventions,
    aiHandled,
    appointmentsScheduled,
    appointmentsCancelled,
    templatesSent,
    leadsByStatusRaw,
    contactsRaw,
    conversationsRaw,
    topLeadSourcesRaw,
  ] = await Promise.all([
    // Total contacts ever
    prisma.contact.count({ where: { workspaceId } }),
    // New contacts in period
    prisma.contact.count({ where: { workspaceId, createdAt: { gte: periodStart } } }),
    // Conversations in period
    prisma.conversation.count({ where: { workspaceId, createdAt: { gte: periodStart } } }),
    // Open conversations
    prisma.conversation.count({ where: { workspaceId, status: { in: ['OPEN', 'PENDING'] } } }),
    // Closed conversations in period
    prisma.conversation.count({ where: { workspaceId, status: { in: ['CLOSED', 'ARCHIVED'] }, updatedAt: { gte: periodStart } } }),
    // Human interventions (conversations that required human)
    prisma.conversation.count({ where: { workspaceId, status: 'HUMAN_REQUIRED', createdAt: { gte: periodStart } } }),
    // AI handled (aiActive = true, not requiring human)
    prisma.conversation.count({ where: { workspaceId, aiActive: true, status: { not: 'HUMAN_REQUIRED' }, createdAt: { gte: periodStart } } }),
    // Appointments scheduled in period
    prisma.appointment.count({ where: { workspaceId, status: 'SCHEDULED', createdAt: { gte: periodStart } } }),
    // Appointments cancelled
    prisma.appointment.count({ where: { workspaceId, status: 'CANCELED', createdAt: { gte: periodStart } } }),
    // Templates sent in period
    prisma.templateSendLog.count({ where: { createdAt: { gte: periodStart }, template: { workspaceId } } }),
    // Leads by status - get all contacts with their status
    prisma.contact.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { status: true },
    }),
    // Contacts per day
    prisma.contact.findMany({
      where: { workspaceId, createdAt: { gte: periodStart } },
      select: { createdAt: true },
    }),
    // Conversations per day
    prisma.conversation.findMany({
      where: { workspaceId, createdAt: { gte: periodStart } },
      select: { createdAt: true },
    }),
    // Top lead sources
    prisma.contact.groupBy({
      by: ['leadSource'],
      where: { workspaceId, leadSource: { not: null } },
      _count: { leadSource: true },
      orderBy: { _count: { leadSource: 'desc' } },
      take: 5,
    }),
  ]);

  // Build per-day series
  const dateSeries = buildDateSeries(periodStart, now);

  const contactsByDay: Record<string, number> = {};
  dateSeries.forEach((d) => (contactsByDay[d] = 0));
  contactsRaw.forEach((c) => {
    const d = c.createdAt.toISOString().slice(0, 10);
    if (contactsByDay[d] !== undefined) contactsByDay[d]++;
  });

  const convByDay: Record<string, number> = {};
  dateSeries.forEach((d) => (convByDay[d] = 0));
  conversationsRaw.forEach((c) => {
    const d = c.createdAt.toISOString().slice(0, 10);
    if (convByDay[d] !== undefined) convByDay[d]++;
  });

  const contactsPerDay = dateSeries.map((date) => ({ date, count: contactsByDay[date] }));
  const conversationsPerDay = dateSeries.map((date) => ({ date, count: convByDay[date] }));

  const leadsByStatus = leadsByStatusRaw.map((r) => ({
    status: r.status,
    count: r._count.status,
  }));

  const topLeadSources = topLeadSourcesRaw
    .filter((r) => r.leadSource)
    .map((r) => ({ source: r.leadSource!, count: r._count.leadSource }));

  return NextResponse.json({
    totalContacts,
    newContacts,
    totalConversations,
    openConversations,
    closedConversations,
    humanInterventions,
    aiHandled,
    appointmentsScheduled,
    appointmentsCancelled,
    templatesSent,
    leadsByStatus,
    contactsPerDay,
    conversationsPerDay,
    topLeadSources,
  });
}
