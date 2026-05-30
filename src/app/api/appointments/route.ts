import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';
import { AppointmentStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const contactId = searchParams.get('contactId');
  const status = searchParams.get('status');
  const start = searchParams.get('start'); // Date ISO string (e.g. range start)
  const end = searchParams.get('end'); // Date ISO string (e.g. range end)

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId };
  if (contactId) where.contactId = contactId;
  if (status) where.status = status as AppointmentStatus;

  if (start || end) {
    where.startTime = {};
    if (start) where.startTime.gte = new Date(start);
    if (end) where.startTime.lte = new Date(end);
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      contact: {
        select: {
          id: true,
          whatsappPhone: true,
          whatsappName: true,
          fullName: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  return NextResponse.json(appointments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, contactId, title, startTime, endTime, notes } = body;

    if (!workspaceId || !contactId || !title || !startTime || !endTime) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate overlapping appointments
    const overlapping = await prisma.appointment.findFirst({
      where: {
        workspaceId,
        status: { in: ['SCHEDULED', 'COMPLETED'] }, // Only active ones overlap
        OR: [
          {
            startTime: { lt: end },
            endTime: { gt: start },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'Conflict: This slot overlaps with an existing appointment.' },
        { status: 409 }
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        workspaceId,
        contactId,
        title,
        startTime: start,
        endTime: end,
        notes,
        status: 'SCHEDULED',
      },
      include: {
        contact: true,
      },
    });

    // Update contact status to APPOINTMENT_SCHEDULED
    await prisma.contact.update({
      where: { id: contactId },
      data: { status: 'APPOINTMENT_SCHEDULED' },
    });

    // Dispatch webhook
    await dispatchWebhook(workspaceId, 'appointment.created', {
      appointment,
      contact: appointment.contact,
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
