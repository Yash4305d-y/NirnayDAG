# NirnayDAG ⚡

> **Computational Architecture Decision Graph Engine, Linter & MCP Server**

NirnayDAG converts static Markdown Architecture Decision Records (ADRs) into an interactive, computational Directed Acyclic Graph (DAG) with real-time Kahn cycle detection, What-If blast radius simulation, CI/CD PR gating, and native AI coding assistant integration via the Model Context Protocol (MCP).

---

## ⚡ The Simplest Ways to Use NirnayDAG

### 🌐 1. View & Interact with Your Graph (Zero Install)
Spins up the interactive visual canvas in your default browser immediately:
```bash
npx nirnay-dag serve ./docs/adr --open
```
- **Search decisions** and filter by status (`ACCEPTED`, `PROPOSED`, `DEPRECATED`, `SUPERSEDED`).
- **Click any node** to slide open its Context, Decision, and Consequences matrix.
- **Click ⚗ Simulate** to test deprecating decisions and view cascading blast corridors.

### 🤖 2. Connect to AI Assistants (Google Antigravity / Cursor)
Add this to your `antigravity.config.json` or `mcp_servers.json`:
```json
{
  "mcpServers": {
    "nirnay-dag": {
      "command": "npx",
      "args": ["-y", "nirnay-dag", "mcp"],
      "env": { "ADR_DIR": "./docs/adr" }
    }
  }
}
```
**Ask your AI in plain English:**
- *"What downstream systems break if we deprecate ADR-0001?"*
- *"Validate our architecture graph and report any circular loops."*
- *"List all accepted infrastructure decisions."*

### 💻 3. Terminal Checks (CLI Linter & Blast Radius)
```bash
# Check for circular loops & broken dependencies
npx nirnay-dag validate ./docs/adr

# Calculate cascading blast radius and risk score (0-100)
npx nirnay-dag blast ADR-0001 ./docs/adr
```

### 🛡️ 4. Automated CI/CD Gate (GitHub Actions)
Copy `.github/workflows/adr-lint.yml` into your repository. Whenever a Pull Request modifies an ADR, GitHub Actions automatically:
- Runs Kahn's algorithm to **block any circular dependency loops**.
- Posts a **formatted blast-radius risk summary table** directly as a PR comment.

---

## 📄 Supported ADR Format (`docs/adr/ADR-0002.md`)

NirnayDAG works with MADR, RFCs, Kubernetes KEPs, and custom frontmatter:

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
We need asynchronous communication between microservices.

# Decision
We will adopt Apache Kafka for high-throughput event streaming.

# Consequences
### Positive
* Loose coupling and persistent replay logs.

### Negative
* Operational overhead of cluster management.
```
*(If frontmatter is omitted, NirnayDAG automatically infers edges from markdown links like `[ADR-0001]` in the body).*

---

## 🛠️ CLI Reference (`ndag`)

If installed globally (`npm install -g nirnay-dag` or `npm link`):

| Command | Description | Example |
| :--- | :--- | :--- |
| `ndag validate [dir]` | Validates DAG integrity and flags cycles | `ndag validate ./sample-adrs` |
| `ndag blast <id> [dir]` | Calculates blast radius and risk score | `ndag blast ADR-0001 ./sample-adrs` |
| `ndag serve [dir]` | Launches the interactive browser canvas | `ndag serve ./adrs --open` |
| `ndag report [dir]` | Generates `nirnay-pr-summary.md` for CI | `ndag report ./adrs` |
| `ndag mcp` | Starts stdio MCP server for AI assistants | `ndag mcp` |

---

## 🧪 Testing & Verification

```bash
npm test            # Run Vitest test suite
npm run demo        # Interactive end-to-end walkthrough
npm run mcp:inspect # Test tools in official MCP Web Inspector
```

---

## 🧱 Tech Stack
- **Graph Computation:** Kahn's Algorithm, Transitive Closure Matrices, Dagre Layout
- **Canvas Dashboard:** React Flow (`@xyflow/react`), Tailwind CSS, Framer Motion, Lucide Icons
- **Protocol & Packaging:** `@modelcontextprotocol/sdk`, Commander, `js-yaml`, `tsup`
