---
id: ADR-0001
title: Choose Kahn's Topological Sort and Dagre for Graph Engine
status: accepted
date: 2026-08-23
---

# Choose Kahn's Topological Sort and Dagre for Graph Engine

## Context and Problem Statement
We need a robust way to analyze the Architecture Decision Records (ADRs) to detect circular dependencies and visualize the graph layout on our web canvas.

## Decision
We chose Kahn's Topological Sort for cycle detection and `dagre` for the visual DAG layout engine instead of heavier alternative graph engines.

## Consequences
- Fast cycle tripwires
- Deterministic and automatic graph layout
