import * as lancedb from "@lancedb/lancedb";
import * as arrow from "apache-arrow";
import { TABLE_NAME, VECTOR_DIMENSIONS, type MemoryEntry } from "./types.js";

export interface SearchResult {
  id: string;
  content: string;
  project: string;
  type: string;
  tags: string;
  created_at: string;
  similarity: number;
}

export interface SearchFilters {
  project?: string;
  type?: string;
}

export interface MemoryStore {
  add(entry: MemoryEntry): Promise<void>;
  search(
    vector: number[],
    limit: number,
    filters?: SearchFilters
  ): Promise<SearchResult[]>;
}

export async function createStore(dbPath: string): Promise<MemoryStore> {
  const db = await lancedb.connect(dbPath);

  let table: lancedb.Table;
  const tableNames = await db.tableNames();

  if (tableNames.includes(TABLE_NAME)) {
    table = await db.openTable(TABLE_NAME);
  } else {
    const schema = new arrow.Schema([
      new arrow.Field("id", new arrow.Utf8()),
      new arrow.Field("content", new arrow.Utf8()),
      new arrow.Field("project", new arrow.Utf8()),
      new arrow.Field("type", new arrow.Utf8()),
      new arrow.Field("agent", new arrow.Utf8()),
      new arrow.Field("tags", new arrow.Utf8()),
      new arrow.Field("created_at", new arrow.Utf8()),
      new arrow.Field("session_id", new arrow.Utf8()),
      new arrow.Field(
        "vector",
        new arrow.FixedSizeList(VECTOR_DIMENSIONS, new arrow.Field("item", new arrow.Float32()))
      ),
    ]);
    table = await db.createEmptyTable(TABLE_NAME, schema);
  }

  return {
    async add(entry: MemoryEntry): Promise<void> {
      await table.add([entry as unknown as Record<string, unknown>]);
    },

    async search(
      vector: number[],
      limit: number,
      filters?: SearchFilters
    ): Promise<SearchResult[]> {
      let query = (table.search(vector) as lancedb.VectorQuery)
        .distanceType("cosine")
        .limit(limit);

      const filterParts: string[] = [];
      if (filters?.project) filterParts.push(`project = '${filters.project}'`);
      if (filters?.type) filterParts.push(`type = '${filters.type}'`);
      if (filterParts.length > 0) {
        query = query.where(filterParts.join(" AND "));
      }

      const results = await query.toArray();

      return results.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        content: row.content as string,
        project: row.project as string,
        type: row.type as string,
        tags: row.tags as string,
        created_at: row.created_at as string,
        similarity: 1 - (row._distance as number),
      }));
    },
  };
}
