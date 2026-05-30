import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

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

  // Get availability rules
  const rules = await prisma.availabilityRule.findMany({
    where: { workspaceId },
  });

  // Extract special rule at dayOfWeek -1 for settings, if any
  const settingsRule = rules.find((r) => r.dayOfWeek === -1);
  const duration = settingsRule ? parseInt(settingsRule.startTime) : 30;
  const buffer = settingsRule ? parseInt(settingsRule.endTime) : 0;

  const activeRules = rules.filter((r) => r.dayOfWeek !== -1);

  return NextResponse.json({
    rules: activeRules,
    duration,
    buffer,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { workspaceId, rules, duration, buffer } = body;

    if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    // Perform transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing rules
      await tx.availabilityRule.deleteMany({
        where: { workspaceId },
      });

      // 2. Insert new day rules
      if (Array.isArray(rules)) {
        for (const rule of rules) {
          if (rule.isActive) {
            await tx.availabilityRule.create({
              data: {
                workspaceId,
                dayOfWeek: parseInt(rule.dayOfWeek),
                startTime: rule.startTime || '09:00',
                endTime: rule.endTime || '18:00',
              },
            });
          }
        }
      }

      // 3. Store settings (duration/buffer) under special dayOfWeek: -1 record
      await tx.availabilityRule.create({
        data: {
          workspaceId,
          dayOfWeek: -1,
          startTime: String(duration || 30),
          endTime: String(buffer || 0),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving availability rules:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
