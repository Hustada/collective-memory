import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VECTOR_DIMENSIONS } from "../src/types.js";

describe("embed", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url, init);
    }) as typeof fetch;
  }

  it("uses OpenAI for embeddings", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, (_, i) => i * 0.002);

    mockFetch((url) => {
      if (url.includes("api.openai.com")) {
        return new Response(
          JSON.stringify({ data: [{ embedding: fakeVector }] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    process.env.OPENAI_API_KEY = "test-key";
    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();
    const result = await embedder.embed("test text");

    expect(embedder.provider).toBe("openai");
    expect(result).toHaveLength(VECTOR_DIMENSIONS);
    expect(result).toEqual(fakeVector);
    delete process.env.OPENAI_API_KEY;
  });

  it("returns 768-dimensional vectors", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, () => Math.random());

    mockFetch((url) => {
      if (url.includes("api.openai.com")) {
        return new Response(
          JSON.stringify({ data: [{ embedding: fakeVector }] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    process.env.OPENAI_API_KEY = "test-key";
    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();
    const result = await embedder.embed("test");

    expect(result).toHaveLength(768);
    delete process.env.OPENAI_API_KEY;
  });

  it("throws when OPENAI_API_KEY not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const { createEmbedder } = await import("../src/embed.js");
    await expect(createEmbedder()).rejects.toThrow("OPENAI_API_KEY not set");
  });

  it("throws on OpenAI API error", async () => {
    mockFetch(() => new Response("", { status: 500 }));

    process.env.OPENAI_API_KEY = "test-key";
    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();

    await expect(embedder.embed("test")).rejects.toThrow("OpenAI embed failed: 500");
    delete process.env.OPENAI_API_KEY;
  });
});
