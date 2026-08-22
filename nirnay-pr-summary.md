# Architecture Decision Graph (ADR) Blast Radius

> [!NOTE]
> **Architecture DAG Validated Successfully** (0 Cycles, 6 Total ADRs)

### Modified ADRs Impact Analysis

| ADR ID | Title | Status | Cascade Count | Max Depth | Risk Level |
|--------|-------|--------|---------------|-----------|------------|
| **ADR-001** | Initial Project Scaffold | accepted | 3 | 2 | 🟢 Low (30) |
| **ADR-001** | Adopt Event-Driven Architecture via Apache Kafka | accepted | 3 | 2 | 🟢 Low (30) |
| **ADR-002** | Migrate Primary Storage to PostgreSQL with pgvector | accepted | 2 | 1 | 🟢 Low (25) |
| **ADR-003** | Legacy In-Memory Pinecone Instance | superseded | 0 | 0 | 🟢 Low (0) |
| **ADR-004** | Deploy Model-Context-Protocol (MCP) Server for Agents | accepted | 1 | 1 | 🟢 Low (15) |
| **ADR-005** | Implement Hybrid GraphRAG for Decision Lineage | proposed | 0 | 0 | 🟢 Low (10) |

### Downstream Impact Details

<details>
<summary><strong>ADR-001 (Initial Project Scaffold)</strong> cascades to 3 decisions</summary>

- ADR-002
- ADR-004
- ADR-005

</details>
<details>
<summary><strong>ADR-001 (Adopt Event-Driven Architecture via Apache Kafka)</strong> cascades to 3 decisions</summary>

- ADR-002
- ADR-004
- ADR-005

</details>
<details>
<summary><strong>ADR-002 (Migrate Primary Storage to PostgreSQL with pgvector)</strong> cascades to 2 decisions</summary>

- ADR-004
- ADR-005

</details>
<details>
<summary><strong>ADR-004 (Deploy Model-Context-Protocol (MCP) Server for Agents)</strong> cascades to 1 decisions</summary>

- ADR-005

</details>
