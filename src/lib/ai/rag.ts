import prisma from '@/lib/prisma';
import { generateEmbedding } from './embeddings';

const SIMILARITY_THRESHOLD = 0.7;

interface RagResult {
  title: string;
  content: string;
  similarity?: number;
  searchType: 'vector' | 'text';
}

interface VectorRow {
  id: string;
  content: string;
  title: string;
  similarity: number;
}

export async function searchKnowledge(workspaceId: string, query: string): Promise<string> {
  const results = await findRelevantChunks(workspaceId, query);

  if (results.length === 0) {
    return '';
  }

  return results
    .map((r) => `--- SOURCE: ${r.title} ---\n${r.content}`)
    .join('\n\n');
}

export async function findRelevantChunks(workspaceId: string, query: string): Promise<RagResult[]> {
  // Try vector search first
  const embedding = await generateEmbedding(query);

  if (embedding.length > 0) {
    try {
      const vectorStr = `[${embedding.join(',')}]`;

      const rows = await prisma.$queryRawUnsafe<VectorRow[]>(
        `
        SELECT
          kc.id,
          kc.content,
          kd.title,
          1 - (kc.embedding <=> $1::vector) AS similarity
        FROM "KnowledgeChunk" kc
        JOIN "KnowledgeDocument" kd ON kd.id = kc."documentId"
        WHERE kd."workspaceId" = $2
          AND kd."isActive" = true
          AND kc.embedding IS NOT NULL
        ORDER BY kc.embedding <=> $1::vector
        LIMIT 5
        `,
        vectorStr,
        workspaceId
      );

      const relevant = rows.filter((r) => r.similarity >= SIMILARITY_THRESHOLD);

      if (relevant.length > 0) {
        return relevant.map((r) => ({
          title: r.title,
          content: r.content,
          similarity: r.similarity,
          searchType: 'vector' as const,
        }));
      }
    } catch {
      // pgvector not available — fall through
    }
  }

  // Text search fallback
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      content: { contains: query, mode: 'insensitive' },
      document: { workspaceId, isActive: true },
    },
    include: { document: { select: { title: true } } },
    take: 5,
  });

  return chunks.map((c) => ({
    title: c.document.title,
    content: c.content,
    searchType: 'text' as const,
  }));
}
