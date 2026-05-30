import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const VALID_ROLES = ['ADMIN', 'MANAGER', 'AGENT', 'VIEWER'];

function generateRandomPassword(length = 8) {
  return crypto.randomBytes(length).toString('base64').slice(0, length);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { email, role } = await req.json();

    if (!email || typeof email !== 'string') {
      return new NextResponse('Invalid email', { status: 400 });
    }
    
    if (!role || !VALID_ROLES.includes(role)) {
       return new NextResponse('Invalid role', { status: 400 });
    }

    // Get current user's workspace
    const currentMembership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    });

    if (!currentMembership) return new NextResponse('No workspace found', { status: 404 });
    const workspaceId = currentMembership.workspaceId;

    // Check if inviter has permission
    if (currentMembership.role !== 'OWNER' && currentMembership.role !== 'ADMIN') {
        return new NextResponse('Forbidden: Must be OWNER or ADMIN to invite members', { status: 403 });
    }

    let user = await prisma.user.findUnique({
        where: { email }
    });

    let tempPassword = null;

    if (!user) {
        tempPassword = generateRandomPassword();
        const passwordHash = await bcrypt.hash(tempPassword, 10);
        user = await prisma.user.create({
            data: {
                email,
                passwordHash
            }
        });
    }

    // Check if already a member
    const existingMember = await prisma.workspaceMember.findUnique({
        where: {
            userId_workspaceId: {
                userId: user.id,
                workspaceId
            }
        }
    });

    if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 });
    }

    await prisma.workspaceMember.create({
        data: {
            userId: user.id,
            workspaceId,
            role: role as "ADMIN" | "MANAGER" | "AGENT" | "VIEWER",
        }
    });

    return NextResponse.json({
      success: true,
      tempPassword
    });

  } catch (error) {
    console.error('Error inviting member:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
