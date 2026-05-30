import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const dateStr = searchParams.get('date'); // YYYY-MM-DD
  const durationParam = searchParams.get('durationMinutes');

  if (!workspaceId || !dateStr) {
    return new NextResponse('Missing required fields workspaceId and date', { status: 400 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  // Get settings (duration & buffer) from the special database record
  const settingsRule = await prisma.availabilityRule.findFirst({
    where: { workspaceId, dayOfWeek: -1 },
  });
  const dbDuration = settingsRule ? parseInt(settingsRule.startTime) : 30;
  const dbBuffer = settingsRule ? parseInt(settingsRule.endTime) : 0;

  const durationMinutes = durationParam ? parseInt(durationParam) : dbDuration;
  const bufferMinutes = dbBuffer;

  // Calculate day of the week
  const dateParts = dateStr.split('-');
  const year = parseInt(dateParts[0]);
  const month = parseInt(dateParts[1]) - 1;
  const day = parseInt(dateParts[2]);
  const queryDate = new Date(year, month, day);

  const dayOfWeek = queryDate.getDay(); // 0 is Sunday, 1 Lunes, etc.

  // Fetch availability rule for this day of week
  const rule = await prisma.availabilityRule.findFirst({
    where: { workspaceId, dayOfWeek },
  });

  if (!rule) {
    return NextResponse.json({ slots: [] });
  }

  // Parse start & end times
  const [startHour, startMin] = rule.startTime.split(':').map(Number);
  const [endHour, endMin] = rule.endTime.split(':').map(Number);

  const startTimeLimit = new Date(year, month, day, startHour, startMin, 0);
  const endTimeLimit = new Date(year, month, day, endHour, endMin, 0);

  // Fetch existing appointments on this date
  const startOfDay = new Date(year, month, day, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59);

  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId,
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  const slots = [];
  let currentStart = new Date(startTimeLimit);
  const now = new Date();

  while (currentStart.getTime() + durationMinutes * 60 * 1000 <= endTimeLimit.getTime()) {
    const currentEnd = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);

    // Check if slot is in the past
    const isPast = currentStart.getTime() < now.getTime();

    // Check overlap with any existing appointment
    const hasOverlap = appointments.some((app) => {
      const appStart = new Date(app.startTime).getTime();
      const appEnd = new Date(app.endTime).getTime();
      const slotStart = currentStart.getTime();
      const slotEnd = currentEnd.getTime();
      return slotStart < appEnd && slotEnd > appStart;
    });

    if (!isPast && !hasOverlap) {
      slots.push({
        startTime: currentStart.toISOString(),
        endTime: currentEnd.toISOString(),
        label: currentStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
    }

    // Advance by duration + buffer
    currentStart = new Date(currentStart.getTime() + (durationMinutes + bufferMinutes) * 60 * 1000);
  }

  return NextResponse.json({ slots });
}
