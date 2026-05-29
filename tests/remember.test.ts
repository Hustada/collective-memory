import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VECTOR_DIMENSIONS } from "../src/types.js";
import { createStore } from "../src/store.js";
import { handleRemember } from "../src/tools/remember.js";
import type { Embedder } from "../src/embed.js";

function fakeEmbedder(): Embedder {
  return {
    provider: "openai",
    async embed(_text: string) {
      return Array.from({ length: VECTOR_DIMENSIONS }, () => Math.random());
    },
  };
}

describe("remember", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "collective-memory-test-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("stores a memory with defaults", async () => {
    const store = await createStore(tmpDir);
    const embedder = fakeEmbedder();

    const result = await handleRemember(store, embedder, {
      content: "TypeScript is the default language",
    });

    expect(result.id).toBeDefined();
    expect(result.project).toBe("global");
    expect(result.type).toBe("context");
    expect(result.created_at).toBeDefined();
  });

  it("accepts optional project and type", async () => {
    const store = await createStore(tmpDir);
    const embedder = fakeEmbedder();

    const result = await handleRemember(store, embedder, {
      content: "Switched to new API design",
      project: "alvis",
      type: "decision",
    });

    expect(result.project).toBe("alvis");
    expect(result.type).toBe("decision");
  });

  it("accepts tags", async () => {
    const store = await createStore(tmpDir);
    const embedder = fakeEmbedder();

    const result = await handleRemember(store, embedder, {
      content: "Use LanceDB for vectors",
      tags: ["architecture", "database"],
    });

    expect(result.id).toBeDefined();
  });

  it("throws on empty content", async () => {
    const store = await createStore(tmpDir);
    const embedder = fakeEmbedder();

    await expect(
      handleRemember(store, embedder, { content: "" })
    ).rejects.toThrow();
  });

  it("deduplicates when identical content is stored", async () => {
    const store = await createStore(tmpDir);
    const vector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0.5);
    const embedder: Embedder = {
      provider: "openai",
      async embed() { return vector; },
    };

    const first = await handleRemember(store, embedder, {
      content: "This is a duplicate test",
    });
    const second = await handleRemember(store, embedder, {
      content: "This is a duplicate test",
    });

    expect(first.deduplicated).toBeUndefined();
    expect(second.deduplicated).toBe(true);
    expect(second.id).toBe(first.id);
  });

  it("does not deduplicate when content differs", async () => {
    const store = await createStore(tmpDir);
    let callCount = 0;
    const embedder: Embedder = {
      provider: "openai",
      async embed() {
        callCount++;
        return Array.from({ length: VECTOR_DIMENSIONS }, (_, i) =>
          Math.sin(callCount * (i + 1))
        );
      },
    };

    const first = await handleRemember(store, embedder, {
      content: "First unique memory",
    });
    const second = await handleRemember(store, embedder, {
      content: "Completely different memory",
    });

    expect(first.deduplicated).toBeUndefined();
    expect(second.deduplicated).toBeUndefined();
    expect(second.id).not.toBe(first.id);
  });

  it("stored memory is retrievable", async () => {
    const store = await createStore(tmpDir);
    const vector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0.5);
    const embedder: Embedder = {
      provider: "openai",
      async embed() { return vector; },
    };

    await handleRemember(store, embedder, {
      content: "This should be findable",
    });

    const results = await store.search(vector, 10);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("This should be findable");
  });
});
