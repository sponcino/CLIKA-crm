import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';
import { AppointmentStatus } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      contact: true,
    },
  });

  if (!appointment) return new NextResponse('Appointment not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: appointment.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  return NextResponse.json(appointment);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, startTime, endTime, notes } = body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) return new NextResponse('Appointment not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: appointment.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (status) updateData.status = status as AppointmentStatus;
    if (notes !== undefined) updateData.notes = notes;

    if (startTime && endTime) {
      updateData.startTime = new Date(startTime);
      updateData.endTime = new Date(endTime);
      updateData.rescheduledCount = appointment.rescheduledCount + 1;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        contact: true,
      },
    });

    // Dispatch webhook
    await dispatchWebhook(appointment.workspaceId, 'appointment.updated', {
      appointment: updated,
      contact: updated.contact,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) return new NextResponse('Appointment not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: appointment.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELED' },
      include: {
        contact: true,
      },
    });

    // Dispatch webhook
    await dispatchWebhook(appointment.workspaceId, 'appointment.cancelled', {
      appointment: updated,
      contact: updated.contact,
    });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('Error canceling appointment:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
