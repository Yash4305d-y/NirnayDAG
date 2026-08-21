# NirnayDAG ⚡️

**Interactive Architecture Decision Record Engine & MCP Server**

Transform your static Markdown Architecture Decision Records (ADRs) into an interactive, computational Directed Acyclic Graph (DAG). NirnayDAG provides automated cycle validation via Kahn's algorithm, blast-radius cascade calculations, a What-If simulation mode, and a robust Model Context Protocol (MCP) server to integrate seamlessly with AI coding assistants.

---

## 🚀 Quickstart

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd nirnaydag
npm install
```

### Running the Ecosystem

**Launch the Interactive Web Canvas:**
```bash
npm run dev
```

**Run Pipeline Tests:**
```bash
npm test
```

**Start the MCP Server for AI Assistants:**
```bash
npm run mcp:start
```

**Test MCP Tools (Interactive Inspector):**
```bash
npm run mcp:inspect
```

---

## 📖 How to Use

### 1. ADR Markdown Format
NirnayDAG parses standard Markdown files enriched with YAML frontmatter. Here is an example of what the engine expects:

```markdown
---
id: ADR-0001
title: Adopt Event-Driven Architecture
status: accepted
date: 2026-08-21
tags: [architecture, core]
depends_on: []
supersedes: []
---
## Context
We need to decouple our microservices.
## Decision
We will adopt an event-driven architecture using Kafka.
## Consequences
### Positive
- High scalability and decoupling.
### Negative
- Operational complexity.
```

### 2. Ingestion
Load your ADRs seamlessly into the web canvas:
- **Local Directory Picker**: Use the built-in File System Access API to pick your local `docs/adr` folder.
- **Drag-and-Drop**: Drop multiple `.md` files or folders directly onto the upload zone (includes a transparent fallback for stricter browsers).
- **Remote GitHub**: Fetch your ADRs dynamically by supplying a GitHub repository URL, branch, and path.

### 3. Graph Navigation & Inspector
- **Interactive Canvas**: Pan, zoom, and explore your architecture visually.
- **Node Inspection**: Click any node to open the side drawer, revealing full context, decisions, and exact downstream blast radiuses.
- **Filtering**: Use the sleek top toolbar to filter by `ACCEPTED`, `PROPOSED`, `DEPRECATED`, and `SUPERSEDED` statuses, or use the search bar to locate specific decisions.

### 4. What-If Simulation Mode
Click the **"What-If Sim"** button in the toolbar to open the Simulation Dock. Toggle the deprecation of critical systems to visualize the cascading blast corridor in real-time. Target nodes glow amber, affected downstream systems pulse red, and unaffected nodes gracefully fade out.

### 5. Multi-Format Export
Export your architecture graph effortlessly for presentations and documentation:
- **High-DPI PNG**: Crisp 2x resolution exports retaining the dark-mode aesthetic.
- **Vector SVG**: Fully scalable vector graphs.
- **JSON Schema**: Export the raw computational DAG state, including topological sorting and precomputed blast radiuses.

---

## 🤖 Antigravity & AI Assistant Integration (MCP)

NirnayDAG ships with a fully compliant Model Context Protocol (MCP) Server, allowing AI coding assistants (like Google Antigravity or Claude) to reason about your architecture natively.

### Configuration
Add this snippet to your `antigravity.config.json` or `mcp_servers.json` to link the server:

```json
{
  "mcpServers": {
    "nirnay-dag": {
      "command": "npx",
      "args": ["-y", "tsx", "src/mcp/server.ts"],
      "env": {
        "ADR_DIR": "./docs/adr"
      },
      "disabled": false,
      "autoApprove": [
        "list_adrs",
        "get_adr_context",
        "query_blast_radius",
        "validate_architecture"
      ]
    }
  }
}
```

### Available MCP Tools & Prompt Examples

NirnayDAG exposes 4 powerful tools to the AI:
1. `list_adrs`: Fetches all decisions, filterable by status and tag.
2. `get_adr_context`: Retrieves full context, decisions, consequences, and deciders for a specific ID.
3. `query_blast_radius`: Computes cascading downstream risks and architecture risk scores.
4. `validate_architecture`: Checks the entire DAG for cyclic dependencies and returns the topological order.

**Try these natural-language queries in your AI Assistant:**
- *"Run `validate_architecture` with NirnayDAG to check for cycles."*
- *"What is the blast radius and downstream risk score if we deprecate ADR-0001?"*
- *"Show me all accepted decisions related to the database."*

---

## 🛠 Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend Framework** | React (Vite) |
| **Graph Visualization** | React Flow & Dagre |
| **Styling** | Tailwind CSS (v4) |
| **Icons** | Lucide React |
| **Markdown Parsing** | js-yaml & custom Regex parsers |
| **AI Integration** | @modelcontextprotocol/sdk |
