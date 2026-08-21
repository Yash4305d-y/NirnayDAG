---
id: ADR-0002
title: Adopt Kafka for Asynchronous Event Streaming
status: accepted
date: 2026-03-15
tags: [messaging, backend, real-time]
depends_on: [ADR-0001]
supersedes: []
---

## Context
Our monolith database cannot handle real-time sync across microservices.

## Decision
Deploy an Apache Kafka cluster to manage all distributed domain events.

## Consequences
### Positive
- Sub-millisecond pub/sub event delivery.
- Reliable event replaying and decoupled service boundaries.

### Negative
- Operational overhead for maintaining ZooKeeper/KRaft clusters.
