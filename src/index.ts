import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createStore } from "./store.js";
import { createEmbedder } from "./embed.js";
import { handleRemember } from "./tools/remember.js";
import { handleRecall } from "./tools/recall.js";
import { DB_PATH } from "./types.js";

const server = new McpServer({
  name: "collective-memory",
  version: "0.1.0",
});

const store = await createStore(DB_PATH);
const embedder = await createEmbedder();

server.tool(
  "remember",
  "Persist important context to collective memory. Use after decisions, completed work, architectural choices, status changes. Be specific and self-contained.",
  {
    content: z.string().describe("The memory to store — specific, self-contained"),
    project: z
      .string()
      .optional()
      .describe('Project context: "companycam", "alvis", "victorcollective", "global"'),
    type: z
      .string()
      .optional()
      .describe('Memory type: "decision", "milestone", "context", "learning", "session_summary"'),
    tags: z
      .array(z.string())
      .optional()
      .describe("Tags for categorization"),
  },
  async ({ content, project, type, tags }) => {
    try {
      const result = await handleRemember(store, embedder, {
        content,
        project,
        type,
        tags,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "recall",
  "Search collective memory. Use at session start, when switching context, when referencing past work.",
  {
    query: z.string().describe("Natural language search query"),
    project: z
      .string()
      .optional()
      .describe("Filter to specific project"),
    type: z
      .string()
      .optional()
      .describe("Filter to specific memory type"),
    limit: z
      .number()
      .optional()
      .describe("Max results to return (default 10)"),
  },
  async ({ query, project, type, limit }) => {
    try {
      const results = await handleRecall(store, embedder, {
        query,
        project,
        type,
        limit,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
