import prisma from '@/lib/prisma';

export async function searchKnowledge(workspaceId: string, query: string): Promise<string> {
  // Simple text search on KnowledgeDocument.content using Prisma contains
  // In M6, this will be upgraded to vector search
  
  const documents = await prisma.knowledgeDocument.findMany({
    where: {
      workspaceId,
      content: {
        contains: query,
        mode: 'insensitive'
      }
    },
    take: 3
  });

  if (documents.length === 0) {
    return "No knowledge base documents found matching the query.";
  }

  const results = documents.map(doc => `--- SOURCE: ${doc.title} ---\n${doc.content}\n`).join('\n');
  return results;
}
