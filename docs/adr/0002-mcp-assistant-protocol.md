---
id: ADR-0002
title: Expose Architecture via Model Context Protocol (MCP)
status: accepted
date: 2026-08-23
depends_on:
  - ADR-0001
affects:
  - "src/mcp/**"
---

# Expose Architecture via Model Context Protocol (MCP)

## Context and Problem Statement
We want AI assistants to automatically analyze architectural blast radius during coding.

## Decision
Implement a Model Context Protocol (MCP) server over `stdio` to provide architectural risk analysis and context to Google Antigravity, Cursor, and Claude Desktop.

## Consequences
- AI agents get live DAG context
- Automated risk analysis during coding sessions
