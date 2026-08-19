import type { NirnayADR } from '../core/types';

export const SAMPLE_ADRS: NirnayADR[] = [
  {
    id: 'ADR-001',
    title: 'Adopt Event-Driven Architecture via Apache Kafka',
    category: 'Infrastructure',
    status: 'accepted',
    timestamp: '2026-01-15',
    context: 'Synchronous REST microservices are leading to cascading timeouts during burst traffic.',
    decision: 'Implement an asynchronous event bus using Kafka for all cross-service state propagation.',
    consequences: {
      pros: ['Decoupled services', 'High throughput', 'Replayable event log'],
      cons: ['Eventual consistency complexity', 'Operational overhead of Kafka clusters'],
    },
    dependencies: [],
  },
  {
    id: 'ADR-002',
    title: 'Migrate Primary Storage to PostgreSQL with pgvector',
    category: 'Database',
    status: 'accepted',
    timestamp: '2026-02-02',
    context: 'Need transactional ACID integrity while indexing high-dimensional embeddings for AI features.',
    decision: 'Consolidate on PostgreSQL with the pgvector extension instead of running separate relational and vector DBs.',
    consequences: {
      pros: ['Unified backup & ACID compliance', 'Lower operational footprint'],
      cons: ['High memory utilization for large vector indexes'],
    },
    dependencies: ['ADR-001'],
  },
  {
    id: 'ADR-003',
    title: 'Legacy In-Memory Pinecone Instance',
    category: 'Database',
    status: 'superseded',
    timestamp: '2025-11-10',
    context: 'Early prototype needed rapid semantic search before self-hosted infra was ready.',
    decision: 'Use managed Pinecone for initial vector lookups.',
    consequences: {
      pros: ['Zero operational setup', 'Fast initial delivery'],
      cons: ['High SaaS cost scaling', 'Siloed data store'],
    },
    dependencies: [],
  },
  {
    id: 'ADR-004',
    title: 'Deploy Model-Context-Protocol (MCP) Server for Agents',
    category: 'AI / Engine',
    status: 'accepted',
    timestamp: '2026-03-20',
    context: 'Autonomous AI agents need secure, standardized tool execution and database introspection.',
    decision: 'Adopt Anthropic Model Context Protocol (MCP) as the unified interface for system tools.',
    consequences: {
      pros: ['Interoperable tool registry', 'Granular sandboxed execution'],
      cons: ['Evolving specification requires ongoing maintenance'],
    },
    dependencies: ['ADR-002'],
  },
  {
    id: 'ADR-005',
    title: 'Implement Hybrid GraphRAG for Decision Lineage',
    category: 'AI / Engine',
    status: 'proposed',
    timestamp: '2026-08-10',
    context: 'Vector search alone misses multi-hop structural causality between engineering choices.',
    decision: 'Layer a Directed Acyclic Graph traversal engine over pgvector embeddings for hybrid search.',
    consequences: {
      pros: ['Deterministic dependency tracing', 'Zero hallucinations on blast radius queries'],
      cons: ['Increased query latency across deep DAG paths'],
    },
    dependencies: ['ADR-002', 'ADR-004'],
  },
];
