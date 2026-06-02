import OpenAI from 'openai';

const MAX_CHARS = 8000;
const MODEL = 'text-embedding-3-small';

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  if (!client) return [];

  const truncated = text.slice(0, MAX_CHARS);
  try {
    const res = await client.embeddings.create({ model: MODEL, input: truncated });
    return res.data[0].embedding;
  } catch (err) {
    console.error('[embeddings] generateEmbedding error:', err);
    return [];
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();
  if (!client) return texts.map(() => []);

  const truncated = texts.map((t) => t.slice(0, MAX_CHARS));
  try {
    const res = await client.embeddings.create({ model: MODEL, input: truncated });
    return res.data.map((d) => d.embedding);
  } catch (err) {
    console.error('[embeddings] generateEmbeddings error:', err);
    return texts.map(() => []);
  }
}
