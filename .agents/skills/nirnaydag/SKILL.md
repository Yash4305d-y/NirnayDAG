---
name: NirnayDAG
description: Invoke this skill when validating Architecture Decision Record (ADR) changes, computing the blast radius before deprecating a decision, or answering "what depends on X" during architecture planning. Useful for ensuring no circular dependencies exist in ADRs and understanding architectural risk.
---

# NirnayDAG Skill Instructions

You have access to the NirnayDAG CLI which allows you to analyze Architecture Decision Records (ADRs).
When interacting with NirnayDAG, **always** use the `--json` or `NDAG_OUTPUT=json` mode to receive structured, machine-readable output rather than the human TUI.

## Common Operations

### Validating ADRs
Before a PR or when asked to check ADR validity:
```bash
npx nirnay-dag validate ./docs/adr --json
```
If this fails, the JSON output will contain `hasCycle`, `cyclePath`, and `missingDependencies`.

### Computing Blast Radius
When deprecating an ADR or evaluating impact of a change:
```bash
npx nirnay-dag blast <ADR-ID> ./docs/adr --json
```
The output will give you `directDependents`, `cascadeCount`, and a `riskScore`.

### Artifact Generation
When computing a full blast radius or validation report as a deliverable artifact for the user, set the environment variable:
```bash
ANTIGRAVITY_SESSION=true npx nirnay-dag report ./docs/adr
```
This will automatically drop the markdown report in `.antigravity/artifacts/`.
