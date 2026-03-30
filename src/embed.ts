import { VECTOR_DIMENSIONS } from "./types.js";

export interface Embedder {
  embed(text: string): Promise<number[]>;
  provider: "ollama" | "openai";
}

const OLLAMA_BASE = "http://localhost:11434";
const OPENAI_BASE = "https://api.openai.com/v1";

async function ollamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return false;
    const data = (await res.json()) as { models: { name: string }[] };
    return data.models.some((m) => m.name.startsWith("nomic-embed-text"));
  } catch {
    return false;
  }
}

async function embedOllama(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", input: text }),
  });
  if (!res.ok) throw new Error(`Ollama embed failed: ${res.status}`);
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings[0];
}

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
  const hasOllama = await ollamaAvailable();

  if (hasOllama) {
    return {
      provider: "ollama",
      async embed(text: string): Promise<number[]> {
        try {
          return await embedOllama(text);
        } catch {
          return embedOpenAI(text);
        }
      },
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "No embedding provider available. Start Ollama with nomic-embed-text or set OPENAI_API_KEY."
    );
  }

  return {
    provider: "openai",
    embed: embedOpenAI,
  };
}
