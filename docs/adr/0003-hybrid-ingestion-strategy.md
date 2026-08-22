---
id: ADR-0003
title: Dual-Source Ingestion Architecture
status: accepted
date: 2026-08-23
depends_on:
  - ADR-0001
---

# Dual-Source Ingestion Architecture

## Context and Problem Statement
We need to load ADRs from local file systems, but browser security models restrict direct access. We also need to support GitHub directly.

## Decision
We will use the File System Access API with a directory input fallback for local usage, alongside a GitHub REST API integration for cloud synchronization.

## Consequences
- Flexibility across local and cloud environments
- Requires polyfills or fallback UI for older browsers
