import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VECTOR_DIMENSIONS, type MemoryEntry } from "../src/types.js";
import { createStore, type MemoryStore } from "../src/store.js";

function fakeVector(seed: number): number[] {
  return Array.from({ length: VECTOR_DIMENSIONS }, (_, i) =>
    Math.sin(seed * (i + 1))
  );
}

function makeEntry(overrides: Partial<MemoryEntry> & { content: string; vector: number[] }): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    content: overrides.content,
    project: "global",
    type: "context",
    agent: "claude-code",
    tags: "[]",
    created_at: new Date().toISOString(),
    session_id: "",
    vector: overrides.vector,
    ...overrides,
  };
}

describe("store", () => {
  let tmpDir: string;
  let store: MemoryStore;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collective-memory-test-"));
    store = await createStore(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("adds an entry and retrieves it by search", async () => {
    const vector = fakeVector(1);
    const entry = makeEntry({ content: "TypeScript is the default", vector });

    await store.add(entry);
    const results = await store.search(vector, 5);

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("TypeScript is the default");
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it("returns results ordered by similarity", async () => {
    const v1 = fakeVector(1);
    const v2 = fakeVector(2);
    const v3 = fakeVector(100);

    await store.add(makeEntry({ content: "close match", vector: v1 }));
    await store.add(makeEntry({ content: "different match", vector: v3 }));
    await store.add(makeEntry({ content: "similar match", vector: v2 }));

    const results = await store.search(v1, 10);
    expect(results[0].content).toBe("close match");
  });

  it("filters by project", async () => {
    const v1 = fakeVector(1);

    await store.add(makeEntry({ content: "alvis memory", vector: v1, project: "alvis" }));
    await store.add(makeEntry({ content: "global memory", vector: v1, project: "global" }));

    const results = await store.search(v1, 10, { project: "alvis" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("alvis memory");
  });

  it("filters by type", async () => {
    const v1 = fakeVector(1);

    await store.add(makeEntry({ content: "a decision", vector: v1, type: "decision" }));
    await store.add(makeEntry({ content: "some context", vector: v1, type: "context" }));

    const results = await store.search(v1, 10, { type: "decision" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("a decision");
  });

  it("filters by project and type together", async () => {
    const v1 = fakeVector(1);

    await store.add(makeEntry({ content: "alvis decision", vector: v1, project: "alvis", type: "decision" }));
    await store.add(makeEntry({ content: "alvis context", vector: v1, project: "alvis", type: "context" }));
    await store.add(makeEntry({ content: "global decision", vector: v1, project: "global", type: "decision" }));

    const results = await store.search(v1, 10, { project: "alvis", type: "decision" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("alvis decision");
  });

  it("respects limit", async () => {
    const v1 = fakeVector(1);

    for (let i = 0; i < 5; i++) {
      await store.add(makeEntry({ content: `memory ${i}`, vector: fakeVector(i + 1) }));
    }

    const results = await store.search(v1, 3);
    expect(results).toHaveLength(3);
  });

  it("returns empty array when no matches", async () => {
    const v1 = fakeVector(1);
    const results = await store.search(v1, 10, { project: "nonexistent" });
    expect(results).toEqual([]);
  });

  it("returns similarity scores between 0 and 1", async () => {
    const v1 = fakeVector(1);
    await store.add(makeEntry({ content: "test", vector: v1 }));

    const results = await store.search(v1, 10);
    expect(results[0].similarity).toBeGreaterThanOrEqual(0);
    expect(results[0].similarity).toBeLessThanOrEqual(1);
  });
});
