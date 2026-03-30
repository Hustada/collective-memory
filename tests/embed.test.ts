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

  it("detects Ollama availability and uses it", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, (_, i) => i * 0.001);

    mockFetch((url) => {
      if (url.includes("localhost:11434/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "nomic-embed-text:latest" }] }),
          { status: 200 }
        );
      }
      if (url.includes("localhost:11434/api/embed")) {
        return new Response(
          JSON.stringify({ embeddings: [fakeVector] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();
    const result = await embedder.embed("test text");

    expect(result).toHaveLength(VECTOR_DIMENSIONS);
    expect(result).toEqual(fakeVector);
  });

  it("falls back to OpenAI when Ollama unavailable", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, (_, i) => i * 0.002);

    mockFetch((url) => {
      if (url.includes("localhost:11434")) {
        throw new Error("Connection refused");
      }
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

    expect(result).toHaveLength(VECTOR_DIMENSIONS);
    expect(result).toEqual(fakeVector);
    delete process.env.OPENAI_API_KEY;
  });

  it("falls back to OpenAI when Ollama lacks nomic-embed-text", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, (_, i) => i * 0.003);

    mockFetch((url) => {
      if (url.includes("localhost:11434/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "llama3:latest" }] }),
          { status: 200 }
        );
      }
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

    expect(result).toEqual(fakeVector);
    delete process.env.OPENAI_API_KEY;
  });

  it("returns 768-dimensional vectors", async () => {
    const fakeVector = Array.from({ length: VECTOR_DIMENSIONS }, () => Math.random());

    mockFetch((url) => {
      if (url.includes("localhost:11434/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "nomic-embed-text:latest" }] }),
          { status: 200 }
        );
      }
      if (url.includes("localhost:11434/api/embed")) {
        return new Response(
          JSON.stringify({ embeddings: [fakeVector] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();
    const result = await embedder.embed("test");

    expect(result).toHaveLength(768);
  });

  it("throws when no provider available", async () => {
    mockFetch(() => {
      throw new Error("Connection refused");
    });

    delete process.env.OPENAI_API_KEY;
    const { createEmbedder } = await import("../src/embed.js");
    await expect(createEmbedder()).rejects.toThrow();
  });

  it("runtime fallback: Ollama dies, catches with OpenAI", async () => {
    let callCount = 0;
    const ollamaVector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0.1);
    const openaiVector = Array.from({ length: VECTOR_DIMENSIONS }, () => 0.2);

    mockFetch((url) => {
      if (url.includes("localhost:11434/api/tags")) {
        return new Response(
          JSON.stringify({ models: [{ name: "nomic-embed-text:latest" }] }),
          { status: 200 }
        );
      }
      if (url.includes("localhost:11434/api/embed")) {
        callCount++;
        if (callCount > 1) {
          throw new Error("Connection refused");
        }
        return new Response(
          JSON.stringify({ embeddings: [ollamaVector] }),
          { status: 200 }
        );
      }
      if (url.includes("api.openai.com")) {
        return new Response(
          JSON.stringify({ data: [{ embedding: openaiVector }] }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    process.env.OPENAI_API_KEY = "test-key";
    const { createEmbedder } = await import("../src/embed.js");
    const embedder = await createEmbedder();

    const first = await embedder.embed("first call");
    expect(first).toEqual(ollamaVector);

    const second = await embedder.embed("second call");
    expect(second).toEqual(openaiVector);

    delete process.env.OPENAI_API_KEY;
  });
});
