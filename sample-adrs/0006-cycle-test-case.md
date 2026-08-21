---
id: ADR-0006
title: Cycle Test Case
status: proposed
date: 2023-05-01
depends_on:
  - ADR-0004
---

## Context
We need to test cycle detection.

## Decision
Create a cyclic dependency with ADR-0004.

## Consequences
### Positive
+ Tests Kahn's algorithm
### Negative
- Invalid graph
