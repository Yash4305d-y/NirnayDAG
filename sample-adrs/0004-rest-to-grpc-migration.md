---
id: ADR-0004
title: REST to gRPC Migration
status: proposed
date: 2023-04-01
depends_on:
  - ADR-0002
  - ADR-0006
supersedes:
  - ADR-0003
---

## Context
We need lower latency communication.

## Decision
Migrate internal APIs from REST/GraphQL to gRPC.

## Consequences
### Positive
+ Low latency
### Negative
- Steep learning curve
