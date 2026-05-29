import * as lancedb from "@lancedb/lancedb";
import { UMAP } from "umap-js";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { DB_PATH, TABLE_NAME } from "../src/types.js";

interface MemoryRow {
  id: string;
  content: string;
  project: string;
  type: string;
  tags: string;
  created_at: string;
  vector: number[];
}

interface ExportedMemory {
  id: string;
  content: string;
  project: string;
  type: string;
  tags: string[];
  created_at: string;
  x: number;
  y: number;
}

async function exportMemories() {
  const db = await lancedb.connect(DB_PATH);
  const table = await db.openTable(TABLE_NAME);

  const rows = (await table.query().toArray()) as unknown as MemoryRow[];
  console.log(`Loaded ${rows.length} memories from LanceDB`);

  if (rows.length < 2) {
    console.error("Need at least 2 memories for UMAP projection");
    process.exit(1);
  }

  // LanceDB returns Arrow Vectors — convert to plain arrays
  // Add tiny jitter to prevent RP-tree infinite recursion on near-duplicate vectors
  const vectors = rows.map((r) => {
    const vec = Array.from(r.vector as Iterable<number>);
    return vec.map((v: number) => v + (Math.random() - 0.5) * 1e-7);
  });

  console.log("Running UMAP projection...");
  const nNeighbors = Math.min(15, Math.max(2, Math.floor(rows.length / 2)));
  const umap = new UMAP({
    nNeighbors,
    minDist: 0.1,
    nComponents: 2,
  });

  const embedding = umap.fit(vectors);

  const exported: ExportedMemory[] = rows.map((row, i) => ({
    id: row.id,
    content: row.content,
    project: row.project,
    type: row.type,
    tags: safeParseTags(row.tags),
    created_at: row.created_at,
    x: embedding[i][0],
    y: embedding[i][1],
  }));

  const outPath = join(dirname(import.meta.url.replace("file://", "")), "..", "viz", "memory-data.json");
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(exported, null, 2));
  console.log(`Wrote ${exported.length} memories to ${outPath}`);
}

function safeParseTags(tags: string): string[] {
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

exportMemories().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
