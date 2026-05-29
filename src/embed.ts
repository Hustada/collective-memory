import { VECTOR_DIMENSIONS } from "./types.js";

export interface Embedder {
  embed(text: string): Promise<number[]>;
  provider: "openai";
}

const OPENAI_BASE = "https://api.openai.com/v1";

async function embedOpenAI(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch(`${OPENAI_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: VECTOR_DIMENSIONS,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI embed failed: ${res.status}`);
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

export async function createEmbedder(): Promise<Embedder> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not set. Required for embeddings.");
  }

  return {
    provider: "openai",
    embed: embedOpenAI,
  };
}
