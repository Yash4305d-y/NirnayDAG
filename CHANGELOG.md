# Changelog

All notable changes to NirnayDAG are documented in this file based on the project's git history.

## [0.9.0] - Unreleased (Phase 5a: Release Readiness)

### Phase 4 — `affects` Glob Matching & `ndag why`
- Parsed and validated `affects` frontmatter globs in `adrParser`.
- Added `affects` glob matching and governing decision resolution (`getDecisionsForFiles`).
- Added `ndag why` CLI command to inspect governing decisions, ancestors, and deprecated flags for a file.
- Added `affects-no-match` and `deprecated-governs-code` linter rules.
- Added `get_adrs_for_files` MCP tool with path traversal protection (including Windows traversal rejection).
- Added "Decisions governing changed files" section to PR blast radius reports.

### Phase 3 — Risk Model v2 & ADR Linter
- Implemented graph-based Risk Model v2 using Brandes centrality and documented it in `docs/RISK_MODEL.md`.
- Added ADR lint rules engine, `.nirnayrc.json` config support, and `ndag lint` CLI command.
- Added `fast-check` property-based tests for DAG invariants and Risk Model v2.
- Integrated Risk Model v2 and lint results into CLI, MCP server, PR report, and README.
- Fixed `getDirectDependents` to exclude self-loops to match `getBlastRadius`.

### Phase 2c.1 — Link Resolution & Classification
- Unified fallback ID derivation and duplicate-ID disambiguation.
- Resolved relative markdown links by file path and classified links (including outside-scope targets against the git tree and ambiguous bare-ID aliases).

### Phase 2b — Edge Kinds
- Separated hard dependencies from soft references (`depends_on` / `supersedes` vs markdown body references) across the DAG engine, CLI (`ndag validate --strict-refs`, `ndag blast --include-soft`), and PR reports.

### Phase 2a — Corpus Benchmarking
- Added corpus runner and benchmark across 7 repositories, pinning corpus SHAs, splitting timing, and reporting extraction quality in `docs/FINDINGS.md` and `results/evidence.json`.
- Detected and reported duplicate ADR IDs in `DAGEngine` and `ndag validate`.

### Phase 1a–1c — Cleanup, Correctness & Packaging
- Extracted pure cycle path detection and handled PR report generation gracefully outside git repositories.
- Built core DAG engine, ADR parser, CLI (`ndag`), MCP server (`stdio`), PR blast radius reporter, and `ndag serve` local visualizer.
