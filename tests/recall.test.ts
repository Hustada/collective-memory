import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VECTOR_DIMENSIONS, type MemoryEntry } from "../src/types.js";
import { createStore, type MemoryStore } from "../src/store.js";
import { handleRemember } from "../src/tools/remember.js";
import { handleRecall } from "../src/tools/recall.js";
import type { Embedder } from "../src/embed.js";

function deterministicEmbedder(seed: number): Embedder {
  return {
    provider: "openai",
    async embed() {
      return Array.from({ length: VECTOR_DIMENSIONS }, (_, i) =>
        Math.sin(seed * (i + 1))
      );
    },
  };
}

function fakeVector(seed: number): number[] {
  return Array.from({ length: VECTOR_DIMENSIONS }, (_, i) =>
    Math.sin(seed * (i + 1))
  );
}

function makeEntry(overrides: Partial<MemoryEntry> & { content: string; vector: number[] }): MemoryEntry {
  return {
    id: crypto.randomUUID(),
    project: "global",
    type: "context",
    agent: "claude-code",
    tags: "[]",
    created_at: new Date().toISOString(),
    session_id: "",
    ...overrides,
  };
}

describe("recall", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collective-memory-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns matching memories", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await handleRemember(store, embedder, {
      content: "TypeScript is the default",
    });

    const results = await handleRecall(store, embedder, {
      query: "what language do we use",
    });

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("TypeScript is the default");
    expect(results[0].similarity).toBeDefined();
  });

  it("filters by project", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await store.add(makeEntry({ content: "Alvis uses AWS", vector: fakeVector(1), project: "alvis" }));
    await store.add(makeEntry({ content: "Global config note", vector: fakeVector(1), project: "global" }));

    const results = await handleRecall(store, embedder, {
      query: "infrastructure",
      project: "alvis",
    });

    expect(results).toHaveLength(1);
    expect(results[0].project).toBe("alvis");
  });

  it("filters by type", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await store.add(makeEntry({ content: "Decided to use LanceDB", vector: fakeVector(1), type: "decision" }));
    await store.add(makeEntry({ content: "Some context", vector: fakeVector(1), type: "context" }));

    const results = await handleRecall(store, embedder, {
      query: "database",
      type: "decision",
    });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("decision");
  });

  it("respects limit", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    for (let i = 0; i < 5; i++) {
      await store.add(makeEntry({ content: `Memory ${i}`, vector: fakeVector(i + 1) }));
    }

    const results = await handleRecall(store, embedder, {
      query: "memory",
      limit: 2,
    });

    expect(results).toHaveLength(2);
  });

  it("defaults limit to 10", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    for (let i = 0; i < 15; i++) {
      await store.add(makeEntry({ content: `Memory ${i}`, vector: fakeVector(i + 1) }));
    }

    const results = await handleRecall(store, embedder, {
      query: "memory",
    });

    expect(results).toHaveLength(10);
  });

  it("returns empty array when nothing matches filter", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await handleRemember(store, embedder, {
      content: "Something",
      project: "alvis",
    });

    const results = await handleRecall(store, embedder, {
      query: "something",
      project: "nonexistent",
    });

    expect(results).toEqual([]);
  });

  it("throws on empty query", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await expect(
      handleRecall(store, embedder, { query: "" })
    ).rejects.toThrow();
  });

  it("returns results with correct shape", async () => {
    const store = await createStore(tmpDir);
    const embedder = deterministicEmbedder(1);

    await handleRemember(store, embedder, {
      content: "Shape test",
      project: "alvis",
      type: "decision",
      tags: ["test"],
    });

    const results = await handleRecall(store, embedder, { query: "shape" });

    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("content");
    expect(results[0]).toHaveProperty("project");
    expect(results[0]).toHaveProperty("type");
    expect(results[0]).toHaveProperty("tags");
    expect(results[0]).toHaveProperty("created_at");
    expect(results[0]).toHaveProperty("similarity");
  });
});
