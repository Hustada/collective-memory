export const VECTOR_DIMENSIONS = 768;

export const MEMORY_TYPES = [
  "decision",
  "milestone",
  "context",
  "learning",
  "session_summary",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface MemoryEntry {
  id: string;
  content: string;
  project: string;
  type: string;
  agent: string;
  tags: string;
  created_at: string;
  session_id: string;
  vector: number[];
}

export const DEFAULT_PROJECT = "global";
export const DEFAULT_TYPE: MemoryType = "context";
export const DEFAULT_AGENT = "claude-code";
export const DEFAULT_LIMIT = 10;

export const DB_PATH = `${process.env.HOME}/.victor-collective/memory`;
export const TABLE_NAME = "memories";
