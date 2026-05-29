# Collective Memory

MCP server for persistent, semantic memory across AI sessions. Store context, decisions, and learnings — recall them later with natural language search.

## Why

AI assistants forget everything between sessions. Collective Memory fixes that. Store what matters, search by meaning, build context that compounds.

## Features

- **Semantic search** — Find memories by meaning, not keywords (OpenAI embeddings + LanceDB)
- **Automatic deduplication** — Won't store near-duplicates (>95% similarity)
- **Project scoping** — Organize memories by project
- **Type classification** — Categorize as `decision`, `milestone`, `context`, `learning`, or `session_summary`
- **Zero config storage** — Embedded vector database, no server required

## Installation

```bash
npm install -g collective-memory
```

Or clone and build:

```bash
git clone https://github.com/victorcollective/collective-memory.git
cd collective-memory
npm install
npm run build
```

## Setup

### 1. Get an OpenAI API key

Required for embeddings. Get one at [platform.openai.com](https://platform.openai.com/api-keys).

### 2. Add to Claude Code

Add to `~/.claude/settings.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "collective-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["collective-memory"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Or if installed from source:

```json
{
  "mcpServers": {
    "collective-memory": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/collective-memory/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### 3. Add usage instructions to CLAUDE.md

Add to your global `~/.claude/CLAUDE.md`:

```markdown
## Memory

Collective Memory is active. Two tools:

- `remember(content, project?, type?, tags?)` — Persist important context
- `recall(query, project?, type?, limit?)` — Search memory

**On session start**: Run `recall("recent decisions and context")` to load relevant memory.

When to remember: after decisions, milestones, completed work, learned patterns.
When to recall: session start, context switches, referencing past work.

Types: decision, milestone, context, learning, session_summary.
```

## Tools

### remember

Store a memory with semantic embedding.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | yes | The memory to store — be specific and self-contained |
| `project` | string | no | Project context (e.g., "myapp", "client-x") |
| `type` | string | no | One of: decision, milestone, context, learning, session_summary |
| `tags` | string[] | no | Tags for categorization |

Returns the stored memory ID, or existing ID if deduplicated.

### recall

Search memories by semantic similarity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural language search query |
| `project` | string | no | Filter to specific project |
| `type` | string | no | Filter to specific memory type |
| `limit` | number | no | Max results (default: 10) |

Returns array of matching memories with similarity scores.

## CLI

Also usable from command line:

```bash
# Store a memory
collective-memory remember --content "Decided to use PostgreSQL for the auth service"

# Search memories
collective-memory recall --query "database decisions" --limit 5

# Pipe content from stdin
echo "Long content here" | collective-memory remember --content-stdin --project myapp
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `OPENAI_API_KEY` | (required) | OpenAI API key for embeddings |
| `COLLECTIVE_MEMORY_PATH` | `~/.collective-memory/data` | Storage location |

## How it works

1. **Store**: Content is embedded using OpenAI's `text-embedding-3-small` (768 dimensions)
2. **Dedupe**: Before storing, checks for >95% similar existing memories
3. **Index**: Stored in LanceDB, an embedded vector database
4. **Search**: Queries are embedded and matched via cosine similarity

## Data

Memories are stored locally at `~/.collective-memory/data` (or `COLLECTIVE_MEMORY_PATH`). It's a LanceDB database — portable, no server process.

To export memories:
```bash
npm run export  # Outputs to viz/memories.json
```

To visualize:
```bash
npm run dash    # Opens UMAP visualization at localhost:3333
```

## License

MIT

## Credits

Built by [The Victor Collective](https://victorcollective.com).
