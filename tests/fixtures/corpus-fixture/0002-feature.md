---
id: ADR-0002
title: Cache Layer Decision
status: accepted
date: 2026-01-02
depends_on:
  - ADR-0001
---
## Context
Need caching layer on top of baseline architecture.

## Decision
Use distributed cache.

## Consequences
### Positive
- Fast reads
### Negative
- Cache invalidation complexity
