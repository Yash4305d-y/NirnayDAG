# NirnayDAG ⚡

> **Computational Architecture Decision Graph Engine, Linter & MCP Server**

NirnayDAG transforms static Markdown **Architecture Decision Records (ADRs)** into an interactive, computational **Directed Acyclic Graph (DAG)**.

It automatically detects circular dependencies using **Kahn’s algorithm**, simulates **blast radii** for architectural deprecation, gates pull requests in CI/CD, and integrates directly with AI coding assistants such as **Cursor, Claude Desktop, and Google Antigravity** through the **Model Context Protocol (MCP)**.


---

## 📖 Table of Contents

* [What is NirnayDAG?](#-what-is-nirnaydag)
* [Why NirnayDAG?](#-why-nirnaydag)
* [Key Features](#-key-features)
* [How NirnayDAG Works](#-how-nirnaydag-works)
* [Supported ADR Format](#-supported-adr-format)
* [Quick Start](#-quick-start)

  * [1. View and Interact with the Graph](#1-view-and-interact-with-the-graph)
  * [2. Local Terminal Validation](#2-local-terminal-validation)
  * [3. Blast Radius Analysis](#3-blast-radius-analysis)
  * [4. AI Assistant Integration](#4-ai-assistant-integration-mcp)
  * [5. Automated CI/CD PR Gating](#5-automated-cicd-pr-gating)
* [Recommended ADR Workflow](#-recommended-adr-workflow)

  * [Step 1: Create an ADR Template](#step-1-create-an-adr-template)
  * [Step 2: Create a New ADR](#step-2-create-a-new-adr)
  * [Step 3: Validate the Graph](#step-3-validate-the-graph)
  * [Step 4: Check the Blast Radius](#step-4-check-the-blast-radius)
  * [Step 5: Gate Pull Requests](#step-5-gate-pull-requests)
  * [Step 6: Query Architecture with AI](#step-6-query-architecture-with-ai)
* [CLI Reference](#-cli-reference-ndag)
* [Development & Testing](#-development--testing)
* [Tech Stack](#-tech-stack)
* [Architecture](#-architecture)
* [License](#-license)

---

## 🔍 What is NirnayDAG?

Architecture Decision Records are a great way to document why technical decisions were made.

The problem is that traditional ADRs are usually just Markdown files sitting inside a repository.

As an architecture grows, questions such as these become difficult to answer:

* What decisions depend on this decision?
* What breaks if we deprecate this technology?
* Are there circular dependencies between decisions?
* Which systems are affected by an architectural change?
* Can an AI assistant understand our architecture before modifying code?
* Can CI automatically prevent invalid architectural decisions?

**NirnayDAG turns ADRs into a computational architecture graph.**

Each ADR becomes a node, while dependencies between decisions become directed edges.

```text
ADR-0001
   │
   ├──────────► ADR-0002
   │                │
   │                └──────────► ADR-0004
   │
   └──────────► ADR-0003
                    │
                    └──────────► ADR-0005
```

This allows NirnayDAG to reason about your architecture instead of simply displaying it.

---

## 🎯 Why NirnayDAG?

NirnayDAG connects **architecture documentation, graph analysis, developer tooling, CI/CD, and AI** into one workflow.

### Traditional ADR workflow

```text
Write ADR
   ↓
Commit Markdown
   ↓
ADR sits in repository
   ↓
Developers manually trace dependencies
```

### NirnayDAG workflow

```text
Write ADR
   ↓
Build Architecture Graph
   ↓
Validate Dependencies
   ↓
Detect Cycles
   ↓
Simulate Blast Radius
   ↓
Visualize Architecture
   ↓
Expose Context to AI
   ↓
Gate Changes in CI/CD
```

---

# ✨ Key Features

### 🔄 Cycle Detection

Uses **Kahn’s topological sorting algorithm** to detect circular dependencies.

For example:

```text
ADR-A → ADR-B → ADR-C → ADR-A
```

is detected as an invalid graph.

---

### 💥 Blast Radius Engine

Before modifying or deprecating a foundational decision, calculate its downstream impact.

NirnayDAG computes transitive dependencies and produces:

* Affected ADRs
* Dependency trees
* Downstream coupling
* Impact depth
* Risk score from **0–100**

---

### 🖥️ Interactive Architecture Canvas

Launch a browser-based graph visualizer with zero installation.

Explore:

* Decision relationships
* Statuses
* Dependency chains
* Decision metadata
* Search results
* Simulated architectural changes

Click **⚗ Simulate** to see downstream impact visually.

---

### 🤖 MCP Integration

Connect the architecture graph directly to AI coding assistants.

NirnayDAG exposes your architectural context through the **Model Context Protocol (MCP)**.

This allows compatible AI assistants to answer architecture-aware questions using your actual ADR graph.

---

### 🚦 CI/CD Architecture Gating

Automatically validate ADR changes in pull requests.

Prevent merges that introduce:

* Circular dependencies
* Broken ADR references
* Invalid graph structures

---

### 🧰 ADR Generator

The included `new-adr.sh` script can:

* Automatically determine the next ADR number
* Generate a standardized ADR
* Create a Git branch
* Generate a URL-friendly filename
* Open the ADR directly in VS Code

---

# 🧠 How NirnayDAG Works

```text
                    Markdown ADRs
                         │
                         ▼
                 ┌───────────────┐
                 │   ADR Parser  │
                 │ YAML + Links  │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │  Graph Engine │
                 │               │
                 │ Kahn's Algo   │
                 │ Transitive    │
                 │ Closure       │
                 └───┬───────┬───┘
                     │       │
             ┌───────┘       └────────┐
             ▼                        ▼
      Interactive UI              MCP Server
        React Flow               AI Assistants
             │                        │
             └──────────┬─────────────┘
                        ▼
                 CI/CD Validation
```

---

# 📄 Supported ADR Format

NirnayDAG parses **MADR, RFCs, Kubernetes KEPs, and custom frontmatter-based ADRs**.

A recommended ADR structure is:

```text
docs/
└── adr/
    ├── template.md
    ├── ADR-0001-initial-architecture.md
    ├── ADR-0002-message-broker.md
    └── ADR-0003-primary-database.md
```

## ADR Frontmatter

NirnayDAG uses frontmatter to accurately identify:

* `id`
* `title`
* `status`
* `date`
* `deciders`
* `depends_on`
* `tags`

Supported statuses:

```text
proposed
accepted
deprecated
superseded
```

### Example

```markdown
---
id: ADR-0002
title: Event-Driven Message Broker
status: accepted
date: 2026-08-23
deciders:
  - Jane Doe
  - John Smith
depends_on:
  - ADR-0001
tags:
  - backend
  - infrastructure
---

# Context and Problem Statement

We need asynchronous communication between microservices.

# Considered Options

* Apache Kafka
* RabbitMQ
* Amazon SQS

# Decision Outcome

Chosen option: **Apache Kafka**.

# Consequences

### Positive Impacts

* Loose coupling
* Persistent replay logs

### Negative Impacts / Trade-offs

* Operational overhead
* Cluster management requirements
```

If `depends_on` is omitted, NirnayDAG can also infer relationships from Markdown references such as:

```markdown
This decision depends on [ADR-0001](./ADR-0001.md).
```

---

# 🚀 Quick Start

The fastest way to use **NirnayDAG** is via `npx` — **zero install needed**.

---

## 1. View and Interact with the Graph

Run:

```bash
npx nirnay-dag serve ./docs/adr --open
```

### What happens?

NirnayDAG launches an interactive browser canvas.

You can:

* Explore your decision hierarchy
* Search ADRs
* Filter by status
* Inspect decision details
* View dependencies
* Click **⚗ Simulate** to test deprecating decisions

---

## 2. Local Terminal Validation

Verify your architecture graph:

```bash
npx nirnay-dag validate ./docs/adr
```

### What happens?

NirnayDAG runs **Kahn’s algorithm** across your graph.

The command exits with:

```text
0 → Graph is valid
1 → Cycle or broken dependency detected
```

For example, this invalid structure:

```text
ADR-A → ADR-B → ADR-C → ADR-A
```

will fail validation.

---

## 3. Blast Radius Analysis

Before modifying or deprecating a decision:

```bash
npx nirnay-dag blast ADR-0001 ./docs/adr
```

### What happens?

NirnayDAG calculates:

* Downstream dependencies
* Dependency depth
* Affected decisions
* Transitive dependency tree
* Risk score from 0–100

You can also inspect the impact visually:

```bash
npx nirnay-dag serve ./docs/adr --open
```

Then click **⚗ Simulate**.

---

## 4. AI Assistant Integration — MCP

Connect NirnayDAG to compatible AI assistants such as:

* Cursor
* Claude Desktop
* Google Antigravity

Add the following to your MCP configuration:

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

### Example queries

Ask your AI assistant:

> "If we deprecate ADR-0003, what dependent services will be impacted?"

> "Check my ADR graph for circular loops."

> "What services will be affected if we deprecate ADR-0001 and replace it with ADR-0003?"

> "List all accepted infrastructure decisions."

---

## 5. Automated CI/CD PR Gating

Create:

```text
.github/workflows/adr-lint.yml
```

```yaml
name: ADR Lint & PR Gate

on:
  pull_request:
    paths:
      - "docs/adr/**"

jobs:
  gate-adrs:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check Cycles & Broken Links
        run: npx nirnay-dag validate ./docs/adr

      - name: Generate PR Blast Radius Report
        run: npx nirnay-dag report ./docs/adr
```

### What happens?

Every pull request modifying ADRs is automatically checked.

Invalid architecture changes can fail the workflow before they are merged.

---

# 🛠️ Recommended ADR Workflow

The following workflow is the recommended way to use NirnayDAG in a project.

---

## Step 1: Create an ADR Template

Create:

```text
docs/adr/template.md
```

Use the following template:

```markdown
---
id: ADR-0000
title: Short Title of Decision
status: proposed
date: 2026-08-23
deciders:
  - Jane Doe
  - John Smith
depends_on:
  - ADR-0001
tags:
  - backend
  - database
---

# Context and Problem Statement

Describe the context and problem behind this decision. What technical or business requirements are forcing this choice?

* Context detail or constraint 1
* Context detail or constraint 2

---

# Considered Options

* **Option 1:** [Title/Description]
* **Option 2:** [Title/Description]
* **Option 3:** [Title/Description]

---

# Decision Outcome

Chosen option: **[Option 1]**, because:

1. Addresses the core scaling/throughput requirement without significant operational friction.
2. Integrates directly with existing infrastructure defined in [ADR-0001].

---

# Consequences

### Positive Impacts

* Improved query response time and read latency.
* Native horizontal scaling support.

### Negative Impacts / Trade-offs

* Introduces additional operational maintenance for cluster management.
* Requires schema migration scripts for legacy data.

### Mitigation Strategies

* Use automated migration runners in CI/CD.
* Set up Datadog alerts for replication lag.
```

This template ensures NirnayDAG can consistently parse:

* IDs
* Dependencies
* Statuses
* Dates
* Deciders
* Tags
* Decision context
* Consequences

---

# Step 2: Create a New ADR

Create `new-adr.sh` in the **root of your project**.

```bash
#!/usr/bin/env bash

set -e

ADR_DIR="./docs/adr"
TEMPLATE_FILE="$ADR_DIR/template.md"

if [ -z "$1" ]; then
  echo "Usage: ./new-adr.sh \"Your Decision Title\""
  exit 1
fi

TITLE="$1"
mkdir -p "$ADR_DIR"

# Find the highest existing ADR number
LATEST_NUM=$(find "$ADR_DIR" -maxdepth 1 -name "ADR-[0-9][0-9][0-9][0-9]*.md" 2>/dev/null \
  | grep -oE '[0-9]{4}' \
  | sort -n \
  | tail -1 || true)

if [ -z "$LATEST_NUM" ]; then
  NEXT_NUM=1
else
  NEXT_NUM=$((10#$LATEST_NUM + 1))
fi

FORMATTED_ID=$(printf "ADR-%04d" "$NEXT_NUM")

SLUG=$(echo "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g' \
  | sed -E 's/^-+|-+$//g')

TARGET_FILE="$ADR_DIR/$FORMATTED_ID-$SLUG.md"
BRANCH_NAME="adr/$FORMATTED_ID-$SLUG"
CURRENT_DATE=$(date +"%Y-%m-%d")

# Create and switch to a new Git branch if inside a Git repository
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "🌿 Creating git branch: $BRANCH_NAME"
  git checkout -b "$BRANCH_NAME"
fi

# Generate ADR from template or fallback
if [ -f "$TEMPLATE_FILE" ]; then
  sed -e "s/^id:.*/id: $FORMATTED_ID/" \
      -e "s/^title:.*/title: $TITLE/" \
      -e "s/^date:.*/date: $CURRENT_DATE/" \
      "$TEMPLATE_FILE" > "$TARGET_FILE"
else
  cat <<EOF > "$TARGET_FILE"
---
id: $FORMATTED_ID
title: $TITLE
status: proposed
date: $CURRENT_DATE
deciders:
  - Team Lead
depends_on: []
tags: []
---

# Context and Problem Statement

Describe the context and problem statement here.

# Considered Options

* Option 1
* Option 2

# Decision Outcome

Chosen option: Option 1.

# Consequences

### Positive Impacts
*

### Negative Impacts / Trade-offs
*
EOF
fi

echo "✨ Created new ADR: $TARGET_FILE"

# Open in VS Code if available
if command -v code >/dev/null 2>&1; then
  echo "📝 Opening in VS Code..."
  code "$TARGET_FILE"
else
  echo "⚠️ 'code' CLI command not found. Open $TARGET_FILE manually in your editor."
fi
```

Make it executable:

```bash
chmod +x new-adr.sh
```

Then create a new ADR:

```bash
./new-adr.sh "PostgreSQL Primary Database"
```

The script automatically:

1. Finds the highest existing ADR number.
2. Generates the next ID.
3. Creates a URL-friendly slug.
4. Creates the ADR file.
5. Copies your standard template.
6. Sets the current date.
7. Creates a Git branch.
8. Opens the ADR in VS Code.

For example:

```text
Title:
PostgreSQL Primary Database

Generated ID:
ADR-0003

Generated file:
docs/adr/ADR-0003-postgresql-primary-database.md

Generated branch:
adr/ADR-0003-postgresql-primary-database
```

---

# Step 3: Validate the Graph

Before committing your ADR:

```bash
npx nirnay-dag validate ./docs/adr
```

This checks:

* Circular dependencies
* Broken ADR references
* Invalid IDs
* Frontmatter integrity
* Graph consistency

For example:

```text
ADR-0001 → ADR-0002 → ADR-0003
```

is valid.

But:

```text
ADR-0001 → ADR-0002 → ADR-0003
     ▲                       │
     └───────────────────────┘
```

contains a cycle and should fail validation.

---

# Step 4: Check the Blast Radius

Before deprecating or significantly changing an existing architectural decision:

```bash
npx nirnay-dag blast ADR-0001 ./docs/adr
```

You can also open the visual canvas:

```bash
npx nirnay-dag serve ./docs/adr --open
```

Then activate:

**⚗ Simulate**

This allows you to visually inspect downstream impact before making the architectural change.

---

# Step 5: Gate Pull Requests

Add the GitHub Actions workflow:

```text
.github/workflows/adr-lint.yml
```

```yaml
name: ADR Lint & PR Gate

on:
  pull_request:
    paths:
      - "docs/adr/**"

jobs:
  gate-adrs:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Check Cycles & Broken Links
        run: npx nirnay-dag validate ./docs/adr

      - name: Generate PR Blast Radius Report
        run: npx nirnay-dag report ./docs/adr
```

Now architectural changes become part of your normal development workflow.

---

# Step 6: Query Architecture with AI

Configure the MCP server:

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

Your AI assistant can now reason over the architecture graph.

Example:

> "What services will be affected if we deprecate ADR-0001 and replace it with ADR-0003?"

Instead of manually searching through dozens of Markdown files, the assistant can query the graph exposed by NirnayDAG.

---

# 🧰 CLI Reference

You can run NirnayDAG using:

```bash
npx nirnay-dag <command>
```

Or install it globally:

```bash
npm install -g nirnay-dag
```

Then use:

```bash
ndag <command>
```

| Command                 | Description                              | Example                          |
| ----------------------- | ---------------------------------------- | -------------------------------- |
| `ndag validate [dir]`   | Validate DAG integrity and detect cycles | `ndag validate ./docs/adr`       |
| `ndag blast <id> [dir]` | Calculate blast radius and risk score    | `ndag blast ADR-0001 ./docs/adr` |
| `ndag serve [dir]`      | Launch interactive graph canvas          | `ndag serve ./docs/adr --open`   |
| `ndag report [dir]`     | Generate PR/CI report                    | `ndag report ./docs/adr`         |
| `ndag mcp`              | Start the MCP server                     | `ndag mcp`                       |

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

Run the test suite:

```bash
npm test
```

Run the interactive demo:

```bash
npm run demo
```

Inspect the MCP server:

```bash
npm run mcp:inspect
```

---

# 🧱 Tech Stack

### Graph Computation

* **Kahn’s Algorithm** — Cycle detection and topological sorting
* **Transitive Closure** — Downstream dependency analysis
* **Dagre** — Graph layout

### Frontend

* **React**
* **React Flow / `@xyflow/react`**
* **Tailwind CSS**
* **Framer Motion**
* **Lucide Icons**

### CLI & Parsing

* **Node.js**
* **TypeScript**
* **Commander.js**
* **js-yaml**
* **tsup**

### AI Integration

* **Model Context Protocol**
* `@modelcontextprotocol/sdk`

---

# 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      ADR Files       │
                    │   docs/adr/*.md      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      ADR Parser      │
                    │                      │
                    │ Frontmatter          │
                    │ Markdown References  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Graph Engine     │
                    │                      │
                    │ Kahn's Algorithm      │
                    │ Transitive Closure   │
                    │ Blast Radius         │
                    └───────┬───────┬──────┘
                            │       │
                ┌───────────┘       └───────────┐
                ▼                               ▼
       ┌─────────────────┐             ┌─────────────────┐
       │ Interactive UI  │             │   MCP Server    │
       │   React Flow    │             │  AI Assistants  │
       └────────┬────────┘             └────────┬────────┘
                │                               │
                └──────────────┬────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │      CI/CD Gate      │
                    │                      │
                    │ Validation           │
                    │ PR Reports           │
                    └──────────────────────┘
```

---

# 🔮 The Bigger Idea

NirnayDAG treats architecture decisions as more than documentation.

They become **computable knowledge**.

```text
Documentation
      ↓
Structured Decisions
      ↓
Dependency Graph
      ↓
Graph Computation
      ↓
Impact Analysis
      ↓
AI Context
      ↓
Automated Architecture Governance
```

The goal is simple:

> **Make architectural decisions visible, computable, and actionable.**

---

# 🤝 Contributing

Contributions, ideas, bug reports, and improvements are welcome.

A typical contribution workflow:

```bash
git checkout -b feature/my-feature

npm install

npm test

git commit -m "feat: add my feature"

git push origin feature/my-feature
```

Open a pull request once your changes are ready.

---

# 📜 License

NirnayDAG is licensed under the [MIT License](LICENSE).

Copyright © 2026 Yash Vinay Kalyani.
---

<p align="center">

**NirnayDAG ⚡**

*Architecture decisions, turned into a computable graph.*

**Completely vibe coded.**

</p>
