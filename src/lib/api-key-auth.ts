import crypto from 'crypto';
import prisma from './prisma';

export async function validateApiKey(request: Request): Promise<{ workspaceId: string } | null> {
  const key = request.headers.get('X-API-Key');
  if (!key) return null;

  const hashed = crypto.createHash('sha256').update(key).digest('hex');

  const record = await prisma.apiKey.findUnique({
    where: { key: hashed },
    select: { id: true, workspaceId: true, isActive: true },
  });

  if (!record || !record.isActive) return null;

  // Fire-and-forget lastUsedAt update
  prisma.apiKey
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { workspaceId: record.workspaceId };
}
