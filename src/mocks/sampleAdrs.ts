import type { NirnayNode } from '../core/types';

export const sampleAdrs: NirnayNode[] = [
  {
    id: 'ADR-001',
    title: 'Migrate to Microservices Architecture',
    status: 'accepted',
    timestamp: '2023-01-15T10:00:00Z',
    context: 'The monolithic application is becoming too large to maintain and deploy efficiently. We need to split it into smaller, independently deployable services to increase developer velocity.',
    decision: 'Adopt a microservices architecture using Docker and Kubernetes. Services will be bounded by domain contexts.',
    consequences: {
      positive: ['Independent deployment', 'Better scalability', 'Technology heterogeneity'],
      negative: ['Increased operational complexity', 'Distributed system challenges (network latency, fault tolerance)']
    },
    dependencies: []
  },
  {
    id: 'ADR-002',
    title: 'Use RabbitMQ for Async Messaging',
    status: 'deprecated',
    timestamp: '2023-03-10T14:30:00Z',
    context: 'Services need to communicate asynchronously without tight coupling.',
    decision: 'Use RabbitMQ as the message broker for all asynchronous communication between microservices.',
    consequences: {
      positive: ['Decoupled services', 'Reliable message delivery'],
      negative: ['Hard to scale globally', 'Complex clustering setup']
    },
    dependencies: ['ADR-001']
  },
  {
    id: 'ADR-003',
    title: 'Adopt Kafka for Event Streaming',
    status: 'accepted',
    timestamp: '2024-02-20T09:15:00Z',
    context: 'RabbitMQ is struggling with our high-throughput event data and replay requirements. We need a more scalable streaming platform.',
    decision: 'Migrate from RabbitMQ to Apache Kafka for high-throughput event streaming and event sourcing capabilities.',
    consequences: {
      positive: ['High throughput and scalability', 'Event replay ability', 'Durable storage'],
      negative: ['Higher operational overhead', 'Complex client configuration']
    },
    dependencies: ['ADR-001'],
    supersedes: 'ADR-002'
  },
  {
    id: 'ADR-004',
    title: 'Centralized Logging with ELK Stack',
    status: 'accepted',
    timestamp: '2023-05-12T11:45:00Z',
    context: 'With microservices, debugging across multiple service logs is tedious. We need a centralized logging solution.',
    decision: 'Implement the ELK stack (Elasticsearch, Logstash, Kibana) for log aggregation and searching.',
    consequences: {
      positive: ['Searchable centralized logs', 'Better observability', 'Custom dashboards'],
      negative: ['Heavy resource usage for Elasticsearch', 'Maintenance of the logging pipeline']
    },
    dependencies: ['ADR-001']
  },
  {
    id: 'ADR-005',
    title: 'Deploy AI Inference on CPUs',
    status: 'superseded',
    timestamp: '2023-08-05T16:00:00Z',
    context: 'We need to deploy our first set of Machine Learning models for user recommendations.',
    decision: 'Run AI inference workloads on standard CPU instances to keep initial costs low and simplify deployment.',
    consequences: {
      positive: ['Low initial cost', 'Standard deployment pipeline'],
      negative: ['High latency for complex models', 'Poor throughput under load']
    },
    dependencies: ['ADR-001']
  },
  {
    id: 'ADR-006',
    title: 'Migrate AI Inference to GPU Cluster',
    status: 'accepted',
    timestamp: '2024-04-10T10:30:00Z',
    context: 'Our new LLM-based features are too slow on CPUs, causing timeouts and bad user experience.',
    decision: 'Provision a dedicated GPU cluster (NVIDIA T4/A10G) specifically for serving large AI models via a gateway.',
    consequences: {
      positive: ['10x latency reduction', 'Ability to run larger models (LLMs)', 'Higher throughput'],
      negative: ['Significant cost increase', 'Specialized infrastructure management']
    },
    dependencies: ['ADR-001'],
    supersedes: 'ADR-005'
  },
  {
    id: 'ADR-007',
    title: 'Implement GraphQL API Gateway',
    status: 'proposed',
    timestamp: '2024-05-01T13:20:00Z',
    context: 'Frontend clients are making too many REST calls to different microservices, leading to over-fetching and slow load times.',
    decision: 'Introduce a GraphQL API Gateway (Apollo Federation) to aggregate microservices and provide a unified, tailored schema for clients.',
    consequences: {
      positive: ['Reduced over-fetching', 'Single endpoint for clients', 'Better developer experience for frontend'],
      negative: ['New single point of failure', 'Complexity in schema stitching/federation', 'Caching challenges']
    },
    dependencies: ['ADR-001']
  }
];
