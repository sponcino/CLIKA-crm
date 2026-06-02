-- Enable pgvector extension (requires PostgreSQL pgvector extension installed on server)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to KnowledgeChunk
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create IVFFlat index for fast cosine similarity search
-- lists=100 is appropriate for up to ~1M vectors; tune as collection grows
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_idx"
ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
