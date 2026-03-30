import { DEFAULT_AGENT, DEFAULT_PROJECT, DEFAULT_TYPE } from "../types.js";
import type { MemoryStore } from "../store.js";
import type { Embedder } from "../embed.js";

export interface RememberInput {
  content: string;
  project?: string;
  type?: string;
  tags?: string[];
}

export interface RememberResult {
  id: string;
  project: string;
  type: string;
  created_at: string;
}

export async function handleRemember(
  store: MemoryStore,
  embedder: Embedder,
  input: RememberInput
): Promise<RememberResult> {
  if (!input.content.trim()) {
    throw new Error("Content cannot be empty");
  }

  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const project = input.project || DEFAULT_PROJECT;
  const type = input.type || DEFAULT_TYPE;

  const vector = await embedder.embed(input.content);

  await store.add({
    id,
    content: input.content,
    project,
    type,
    agent: DEFAULT_AGENT,
    tags: JSON.stringify(input.tags || []),
    created_at,
    session_id: process.env.CLAUDE_SESSION_ID || "",
    vector,
  });

  return { id, project, type, created_at };
}
