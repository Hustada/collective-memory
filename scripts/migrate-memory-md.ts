import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createStore } from "../src/store.js";
import { createEmbedder } from "../src/embed.js";
import { handleRemember } from "../src/tools/remember.js";
import { DB_PATH } from "../src/types.js";

const MEMORY_FILE = join(process.env.HOME!, ".claude", "memory.md");

async function migrate() {
  const content = await readFile(MEMORY_FILE, "utf-8");
  const lines = content.split("\n");

  const entries: { content: string; date: string }[] = [];
  let currentDate = "";

  for (const line of lines) {
    const dateMatch = line.match(/^## (\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      continue;
    }

    if (line.startsWith("- ") && line.trim().length > 2) {
      entries.push({
        content: line.slice(2).trim(),
        date: currentDate,
      });
    }
  }

  console.log(`Found ${entries.length} entries to migrate`);

  const store = await createStore(DB_PATH);
  const embedder = await createEmbedder();

  for (const entry of entries) {
    const type = classifyEntry(entry.content);
    const project = detectProject(entry.content);

    const result = await handleRemember(store, embedder, {
      content: entry.content,
      project,
      type,
      tags: ["migrated-from-memory-md"],
    });

    console.log(`  ✓ ${result.id.slice(0, 8)} [${type}/${project}] ${entry.content.slice(0, 60)}...`);
  }

  console.log(`\nMigrated ${entries.length} entries to Collective Memory`);
}

function classifyEntry(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("decided") || lower.includes("decision") || lower.includes("strategy")) return "decision";
  if (lower.includes("deployed") || lower.includes("committed") || lower.includes("pushed") || lower.includes("merged")) return "milestone";
  if (lower.includes("reviewed") || lower.includes("assessed")) return "context";
  if (lower.includes("learned") || lower.includes("fixed") || lower.includes("issue")) return "learning";
  return "context";
}

function detectProject(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("victorcollective") || lower.includes("victor collective") || lower.includes("obsidian ember")) return "victorcollective";
  if (lower.includes("alvis") || lower.includes("verdandi")) return "alvis";
  if (lower.includes("companycam")) return "companycam";
  if (lower.includes("chris johnson") || lower.includes("image inflators") || lower.includes("strategic edge")) return "chris-johnson";
  if (lower.includes("character api")) return "victorcollective";
  if (lower.includes("kodeskald")) return "kodeskald";
  if (lower.includes("portal")) return "victorcollective";
  if (lower.includes("claude.md") || lower.includes("memory")) return "global";
  return "global";
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
