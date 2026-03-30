import { DEFAULT_LIMIT } from "../types.js";
import type { MemoryStore, SearchResult } from "../store.js";
import type { Embedder } from "../embed.js";

export interface RecallInput {
  query: string;
  project?: string;
  type?: string;
  limit?: number;
}

export async function handleRecall(
  store: MemoryStore,
  embedder: Embedder,
  input: RecallInput
): Promise<SearchResult[]> {
  if (!input.query.trim()) {
    throw new Error("Query cannot be empty");
  }

  const limit = input.limit || DEFAULT_LIMIT;
  const vector = await embedder.embed(input.query);

  return store.search(vector, limit, {
    project: input.project,
    type: input.type,
  });
}
