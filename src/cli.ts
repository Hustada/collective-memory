import { createStore } from "./store.js";
import { createEmbedder } from "./embed.js";
import { handleRemember } from "./tools/remember.js";
import { handleRecall } from "./tools/recall.js";
import { DB_PATH } from "./types.js";

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const command = argv[2];
  const flags: Record<string, string> = {};

  for (let i = 3; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    }
  }

  return { command, flags };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  if (!command || command === "help") {
    console.log(JSON.stringify({
      usage: "node dist/cli.js <command> [flags]",
      commands: {
        remember: "--content <text> [--project <p>] [--type <t>] [--tags <comma-separated>] [--content-stdin]",
        recall: "--query <text> [--project <p>] [--type <t>] [--limit <n>]",
      },
    }, null, 2));
    return;
  }

  const store = await createStore(DB_PATH);
  const embedder = await createEmbedder();

  if (command === "remember") {
    let content = flags.content || "";
    if (flags["content-stdin"] === "true") {
      content = await readStdin();
    }
    if (!content) {
      console.error(JSON.stringify({ error: "Missing --content or --content-stdin" }));
      process.exit(1);
    }

    const tags = flags.tags ? flags.tags.split(",").map((t) => t.trim()) : undefined;

    const result = await handleRemember(store, embedder, {
      content,
      project: flags.project,
      type: flags.type,
      tags,
    });

    console.log(JSON.stringify(result, null, 2));
  } else if (command === "recall") {
    const query = flags.query;
    if (!query) {
      console.error(JSON.stringify({ error: "Missing --query" }));
      process.exit(1);
    }

    const results = await handleRecall(store, embedder, {
      query,
      project: flags.project,
      type: flags.type,
      limit: flags.limit ? parseInt(flags.limit, 10) : undefined,
    });

    console.log(JSON.stringify(results, null, 2));
  } else {
    console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: String(err) }));
  process.exit(1);
});
