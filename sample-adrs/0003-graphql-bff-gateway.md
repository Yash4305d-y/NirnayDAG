---
id: ADR-0003
title: GraphQL BFF Gateway
status: accepted
date: 2023-03-01
depends_on:
  - ADR-0001
  - ADR-0002
---

## Context
Clients need aggregated data from multiple microservices.

## Decision
Introduce a GraphQL Backend-For-Frontend Gateway.

## Consequences
### Positive
+ Optimized client payloads
### Negative
- Single point of failure if not scaled
