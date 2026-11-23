# NirnayDAG ⚡

> **Computational Architecture Decision Graph Engine, Linter & MCP Server**

NirnayDAG transforms static Markdown **Architecture Decision Records (ADRs)** into an interactive, computational **Directed Acyclic Graph (DAG)**.

It automatically detects circular dependencies using **Kahn’s algorithm**, simulates **blast radii** for architectural deprecation, gates pull requests in CI/CD, and integrates directly with AI coding assistants such as **Cursor, Claude Desktop, and Google Antigravity** through the **Model Context Protocol (MCP)**.

---

## 📖 Table of Contents

* [What is NirnayDAG?](#-what-is-nirnaydag)
* [Why NirnayDAG?](#-why-nirnaydag)
* [Key Features](#-key-features)
* [Supported ADR Format](#-supported-adr-format)
* [Quick Start](#-quick-start)

  * [1. Interactive Canvas](#1-interactive-canvas)
  * [2. Graph Validation & Cycle Detection](#2-graph-validation--cycle-detection)
  * [3. Blast Radius Simulation](#3-blast-radius-simulation)
  * [4. CI/CD PR Gating & Markdown Reports](#4-cicd-pr-gating--markdown-reports)
  * [5. AI Assistant Integration (MCP)](#5-ai-assistant-integration-mcp)
* [CLI Reference](#-cli-reference)
* [How It Works](#-how-it-works)
* [Development & Testing](#-development--testing)
* [Tech Stack](#-tech-stack)
* [Contributing](#-contributing)
* [License](#-license)

---

## 🔍 What is NirnayDAG?

Architecture Decision Records are essential for documenting technical choices. However, traditional ADRs are static files stored in a repository.

This creates important questions:

* What decisions depend on this choice?
* What breaks if we deprecate this technology?
* Are there circular dependencies between decisions?
* Can an AI assistant understand our architecture before generating or refactoring code?
* Can CI automatically block broken architectural dependencies?

**NirnayDAG converts ADRs into a computational architecture graph.**

Each ADR becomes a node, while dependencies between decisions become directed edges.

```text
ADR-0001
   │
   ├──────────► ADR-0002
   │                 │
   │                 └──────────► ADR-0004
   │
   └──────────► ADR-0003
                     │
                     └──────────► ADR-0005
```

---

## 🎯 Why NirnayDAG?

NirnayDAG bridges **architecture documentation, graph algorithms, developer tooling, CI/CD, and AI** into a unified pipeline:

```text
Write ADR
    │
    ▼
Build DAG
    │
    ▼
Kahn's Validation
    │
    ▼
Blast Radius
    │
    ├──────────────► Interactive UI
    │
    └──────────────► MCP AI Context
```

Instead of treating ADRs as passive documentation, NirnayDAG makes architectural decisions **computable, testable, visual, and AI-accessible**.

---

## ✨ Key Features

### 🔄 Cycle Detection

Uses **Kahn's topological sorting algorithm** to detect circular architectural dependencies.

Example:

```text
ADR-A → ADR-B → ADR-C → ADR-A
```

Such cycles are flagged during validation.

### 💥 Blast Radius Engine

Computes the downstream impact of changing or deprecating an architectural decision.

Includes:

* **Direct dependents**: Nodes that directly depend on the target decision
* **Transitive cascade**: Complete list of downstream nodes impacted across the dependency graph
* **Hierarchy depth**: Real longest-path traversal through dependents (cycle-safe)
* **Affected systems**: Downstream decisions grouped by frontmatter `tags` (with `untagged` fallback)
* **Architectural risk score (0–100)**: Explainable heuristic calculation (`v1, heuristic`) weighting direct dependents (5 pts each) and cascading descendants (10 pts each), categorized into Low, Medium, and High risk with full factor breakdown

### 🖥️ Zero-Install Web Canvas

Launch a local browser-based interactive architecture graph powered by **React Flow**.

### 🤖 Model Context Protocol (MCP)

Connects architecture context directly to AI coding assistants such as:

* Cursor
* Claude Desktop
* Google Antigravity

This allows AI assistants to reason about architectural decisions before generating or modifying code.

### 🚦 CI/CD Governance

Validate ADR dependency graphs automatically in CI/CD and generate Markdown impact reports for pull requests.

### 📄 Universal Format Support

Supports:

* YAML frontmatter
* Standard Markdown links
* MADR-style ADRs
* RFC-style documents
* Kubernetes KEP-style documents
* Other frontmatter-based Markdown architecture documents

---

## 📄 Supported ADR Format

NirnayDAG parses **YAML frontmatter** as well as **standard Markdown link fallbacks**.

### Recommended Directory Structure

```text
my-project/
└── docs/
    └── adr/
        ├── ADR-0001-microservices-core.md
        ├── ADR-0002-event-driven-broker.md
        └── ADR-0003-primary-database.md
```

### Example Frontmatter

```markdown
---
id: ADR-0002
title: Event-Driven Message Broker
status: accepted
date: 2026-08-24
deciders:
  - Architecture Guild
depends_on:
  - ADR-0001
tags:
  - backend
  - infrastructure
---

# Context and Problem Statement

We require an asynchronous messaging backbone between core services.

# Decision Outcome

Chosen option: **Apache Kafka** because it satisfies stream persistence
requirements defined in [ADR-0001](./ADR-0001-microservices-core.md).

# Consequences

- Loose coupling across domain boundaries.
- Additional infrastructure overhead.
```

### Supported Statuses

* `proposed`
* `accepted`
* `deprecated`
* `superseded`

---

# 🚀 Quick Start

Run NirnayDAG directly inside any project using `npx` — **no global installation required**.

## 1. Interactive CLI Mode

Launch a fully interactive terminal session to explore ADRs, visualize neighborhood graphs, and simulate blast radii directly from your CLI:

```bash
npx nirnay-dag interactive ./docs/adr
```

Shortcuts:
- `↑ / ↓` and `Enter`: Navigate and select ADRs
- `b`: Inline blast radius simulation
- `v`: Re-run cycle detection validation
- `:`: Command palette

---

## 2. Interactive Canvas

Visualize your architecture decision graph in your browser:

```bash
npx nirnay-dag serve ./docs/adr --open
```

You can omit the directory if your ADRs are located in `./docs/adr`, or provide a custom directory:

```bash
npx nirnay-dag serve ./sample-adrs --open
```

---

## 3. Graph Validation & Cycle Detection

Validate graph integrity, detect circular references, and identify missing dependency IDs:

```bash
npx nirnay-dag validate ./docs/adr
```

Exit codes:

```text
0 — Graph is structurally valid
1 — Cycle, broken link, or invalid schema detected
```

---

## 4. Blast Radius Simulation

Simulate the cascading downstream impact of deprecating or changing a decision:

```bash
npx nirnay-dag blast ADR-0001 ./docs/adr
```

Output includes:

* **Direct dependents**: Count of decisions directly depending on this ADR
* **Cascade count & list**: Total number and IDs of cascading downstream decisions
* **Impact hierarchy depth**: Longest path through dependents from this node
* **Affected systems**: Tag-based system grouping of affected decisions
* **Architectural risk score**: Score from 0–100, risk level (Low / Medium / High), and explainable factor breakdown

---

## 5. CI/CD PR Gating & Markdown Reports

Generate a structured Markdown report for CI/CD pipelines or pull request comments:

```bash
npx nirnay-dag report ./docs/adr
```

### GitHub Actions Workflow Example

Create:

```text
.github/workflows/adr-lint.yml
```

```yaml
name: ADR Validation & Blast Radius

on:
  pull_request:
    paths:
      - "docs/adr/**"

jobs:
  validate-adrs:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Validate ADR DAG
        run: npx -y nirnay-dag validate ./docs/adr

      - name: Generate Blast Radius Report
        run: npx -y nirnay-dag report ./docs/adr
```

---

## 6. AI Assistant Integration (MCP & Antigravity)

### Google Antigravity Skill Setup

NirnayDAG includes a native Antigravity skill descriptor to automatically assist with ADR validation and blast radius checks during Agent planning.

To install the skill for your workspace:
1. Ensure the `.agents/skills/nirnaydag/SKILL.md` descriptor is in your repository.
2. Antigravity will now automatically invoke NirnayDAG when discussing architecture changes, validating ADRs, or assessing blast radius.
3. NirnayDAG will intelligently export reports as artifacts to `.antigravity/artifacts/` when run non-interactively by agents.

### Standard MCP Server

NirnayDAG runs as a standard **Model Context Protocol (MCP) server over stdio**.

Add the following configuration to your MCP client, such as Cursor, Antigravity, or Claude Desktop:

```json
{
  "mcpServers": {
    "nirnay-dag": {
      "command": "npx",
      "args": ["-y", "nirnay-dag", "mcp"],
      "env": {
        "ADR_DIR": "./docs/adr"
      }
    }
  }
}
```

### Example MCP Prompts

```text
"What is the blast radius if we deprecate ADR-0002?"

"Are there any circular dependencies between my accepted ADRs?"

"Which infrastructure decisions are superseded by newer records?"
```

---

# 🧰 CLI Reference

You can run commands through:

```bash
npx nirnay-dag <command>
```

Or install NirnayDAG globally:

```bash
npm install -g nirnay-dag
```

After global installation, use the `ndag` binary:

| Command                                    | Description                                      | Example                          |
| ------------------------------------------ | ------------------------------------------------ | -------------------------------- |
| `ndag serve [dir] [--open] [--port <num>]` | Launch interactive React Flow web canvas         | `ndag serve ./docs/adr --open`   |
| `ndag interactive [dir]`                   | Launch interactive terminal UI (TUI)             | `ndag interactive ./docs/adr`    |
| `ndag validate [dir]`                      | Check DAG for circular loops and broken links    | `ndag validate ./docs/adr`       |
| `ndag blast <id> [dir]`                    | Calculate downstream blast radius and risk score | `ndag blast ADR-0001 ./docs/adr` |
| `ndag report [dir]`                        | Generate Markdown blast-radius report            | `ndag report ./docs/adr`         |
| `ndag mcp`                                 | Start the stdio MCP server                       | `ndag mcp`                       |

---

# 🧠 How It Works

```text
              Markdown ADRs (*.md)
                       │
                       ▼
            ┌─────────────────────┐
            │     ADR Parser      │
            │ Frontmatter & MD    │
            │                     │
            │ • YAML frontmatter │
            │ • Metadata          │
            │ • Markdown links    │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │    Graph Engine     │
            │   DAG & Topo Engine │
            │                     │
            │ • Kahn's Algorithm  │
            │ • Transitive        │
            │   closure           │
            └──────────┬──────────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
       ┌──────────────┐  ┌──────────────┐
       │  Graph/UI    │  │   Analysis   │
       │              │  │              │
       │ React Flow   │  │ Blast Radius │
       │ + Dagre      │  │ Risk Scoring │
       └──────┬───────┘  └──────┬───────┘
              │                 │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   Interactive       MCP        CI/CD Gate
      Canvas       AI Context    Validation
```

---

# 🧪 Development & Testing

Clone the repository:

```bash
git clone https://github.com/your-org/nirnay-dag.git
cd nirnay-dag
```

Install dependencies:

```bash
npm install
```

Build the CLI and client bundles:

```bash
npm run build
```

Run unit and integration tests:

```bash
npm test
```

Run the local CLI against sample data:

```bash
node ./dist/cli.js serve ./sample-adrs --open
```

---

# 🧱 Tech Stack

| Area              | Technology                           |
| ----------------- | ------------------------------------ |
| Graph Computation | Kahn's Algorithm, Transitive Closure |
| Graph Layout      | Dagre                                |
| UI Engine         | React, `@xyflow/react`               |
| Styling           | Tailwind CSS                         |
| UI Animation      | Framer Motion                        |
| CLI               | Node.js, TypeScript, Commander.js    |
| Parsing           | `js-yaml`                            |
| Bundling          | tsup                                 |
| AI Protocol       | `@modelcontextprotocol/sdk`          |
| Testing           | Unit & Integration Tests             |

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch:

```bash
git checkout -b feat/graph-enhancement
```

3. Make your changes.
4. Run the test suite:

```bash
npm test
```

5. Commit your changes:

```bash
git commit -m "feat: add cluster grouping"
```

6. Push the branch and open a Pull Request.

---

## 📜 License

NirnayDAG is licensed under the **MIT License**.

See the [LICENSE](./LICENSE) file for the full license text.
