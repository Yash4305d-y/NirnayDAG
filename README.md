# NirnayDAG ⚡

> **Computational Architecture Decision Graph Engine, Linter & MCP Server**

NirnayDAG converts static Markdown ADRs into an interactive, computational Directed Acyclic Graph (DAG) with real-time Kahn cycle detection, What-If blast radius simulation, CI/CD PR gating, and native AI assistant integration via Model Context Protocol (MCP).

---

## 🚀 Quickstart

```bash
# Clone & install
git clone https://github.com/your-username/nirnaydag.git
cd nirnaydag && npm install

# Build & link global CLI
npm run build && npm link

# Start the interactive UI
ndag serve ./sample-adrs --open
```

## 🛠️ CLI Cheat Sheet (`ndag`)

```bash
ndag validate ./adrs             # Check for circular loops & broken links
ndag blast ADR-0001 -d ./adrs    # Calculate cascading blast radius & risk score
ndag serve ./adrs --open         # Launch the visual canvas dashboard
ndag report ./adrs               # Generate PR summary markdown for CI
ndag mcp                         # Start stdio MCP server for AI assistants
```

## 📄 Sample ADR Format (`docs/adr/ADR-0002.md`)

```markdown
---
id: ADR-0002
title: Event-Driven Message Broker
status: accepted # accepted | proposed | deprecated | superseded
depends_on:
  - ADR-0001
tags:
  - backend
  - infrastructure
---

# Context
Need asynchronous communication between microservices.

# Decision
Adopt Apache Kafka for high-throughput event streaming.

# Consequences
### Positive
* Loose coupling and persistent replay logs.

### Negative
* Operational overhead of cluster management.
```

## 🤖 Google Antigravity / MCP Integration

Add this to `antigravity.config.json` or your MCP server settings:

```json
{
  "mcpServers": {
    "nirnay-dag": {
      "command": "ndag",
      "args": ["mcp"],
      "env": { "ADR_DIR": "./docs/adr" },
      "autoApprove": [
        "get_decision_graph",
        "get_blast_radius",
        "validate_architecture_dag"
      ]
    }
  }
}
```

**Example AI Prompts:**
- *"Run `validate_architecture_dag` to check for circular dependency loops."*
- *"What is the blast radius and risk score if we deprecate ADR-0001?"*

## 🧪 Test & Verify

```bash
npm test            # Run Vitest test suite
npm run demo        # Interactive end-to-end CLI walkthrough
npm run mcp:inspect # Test MCP tools inside the visual MCP inspector
```

## 🧱 Stack

- **Engine**: Kahn's Topological Sort, Transitive Closures, Dagre
- **Canvas**: @xyflow/react, Tailwind CSS, Framer Motion, Lucide
- **CLI & AI Protocol**: @modelcontextprotocol/sdk, Commander, tsup
