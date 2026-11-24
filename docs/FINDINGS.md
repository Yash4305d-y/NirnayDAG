# NirnayDAG Corpus Benchmark Findings (Phase 2A.2 + 2B)

> Benchmark Executed: 2026-11-24T20:46:38.662Z  
> Runner Version: `1.0.0-phase2c.1`  
> Scope: Hard vs. Soft dependency edge classification and Data-Integrity Fixes across pinned open-source decision-record commits.

---

## 1. Executive Summary

NirnayDAG's parser and DAG engine were run against **7 open-source repositories** pinned to exact commit SHAs across `madr`, `rfc`, `kep`, `adr`, `nygard` formats.

- **Total Decision Files Found:** 1565
- **Parsed OK:** 1565 (100%) — *see definition below*
- **Total Graph Nodes:** 1565 (1565 unique IDs; 4 files with initial ID collisions before disambiguation)
- **Total Active Graph Edges:** 353 (0 hard, 353 soft)
- **Total Isolated Nodes:** 1186
- **Unresolved References (Broken Links):** 98 (unvalidated)
- **Repositories with Hard Cycles:** 0
- **Soft Mutual References:** 14 pair(s) (informational, non-failing)

> **Definition — "Parsed OK":** A non-empty file where `parseADRContent()` did not throw and returned a non-null `ParsedADR` object with a non-empty `frontmatter.id` (whether from frontmatter, filename fallback, or generated ID). **"Parsed OK" measures parser survival, not metadata extraction quality**—which is reported separately in the extraction-quality columns immediately next to it.

### Data Quality

In Phase 2A.1, `kubernetes/enhancements` had 708 markdown files, 689 of which were named `README.md` inside KEP subdirectories. All 689 received the fallback ID `"README"`, and `DAGEngine`'s `Map` silently overwrote colliding entries—collapsing 708 files down to 19 graph nodes while the corpus report counted `mappedAdrs.length` (708) instead of the engine's actual graph size. In Phase 2A.2, this was fixed in three ways: (1) `DAGEngine` now records duplicate IDs (with every file path involved) as a validation error and `ndag validate` fails on them rather than silently overwriting; (2) the corpus analyzer derives fallback IDs for generic filenames (`README.md`, `index.md`) from their parent directory name (e.g., `keps/sig-api/1027-api-unions/README.md` → `1027-api-unions`) and disambiguates any remaining collisions by appending the relative file path; and (3) `Nodes`, `Edges`, `Isolated Nodes`, and `Edge Density` are read directly from `DAGEngine`'s graph.

---

## 2. Benchmark Results & Extraction Quality

| Repository | Commit | Format | License | Files Found | Parsed OK | Parse Rate | Real Title % | Status Found % | ID Source (FM / File / Gen) | Duplicate IDs | Unique IDs | Nodes | Edges (Hard / Soft) | Edge Density | Isolated Nodes | Hard Cycles | Mutual Refs | Broken Links | Analysis Time | Checkout Time (cached) |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [backstage/backstage](https://github.com/backstage/backstage.git) | `b3ed969` | `madr` | Apache-2.0 | 17 | 17 | 100% | 100% | 0% | 100% / 0% / 0% | 0 | 17 | 17 | 0 / 4 | 0.235 | 12 | None | 1 | 0 | 26ms | 57ms |
| [adr/madr](https://github.com/adr/madr.git) | `ba75bb1` | `madr` | MIT | 21 | 21 | 100% | 100% | 4.8% | 0% / 100% / 0% | 0 | 21 | 21 | 0 / 4 | 0.19 | 16 | None | 1 | 0 | 15ms | 51ms |
| [rust-lang/rfcs](https://github.com/rust-lang/rfcs.git) | `f43d578` | `rfc` | MIT / Apache-2.0 | 654 | 654 | 100% | 7.5% | 0% | 0% / 100% / 0% | 2 | 654 | 654 | 0 / 12 | 0.018 | 624 | None | 0 | 21 | 409ms | 51ms |
| [kubernetes/enhancements](https://github.com/kubernetes/enhancements.git) | `cac930c` | `kep` | Apache-2.0 | 708 | 708 | 100% | 97.9% | 0% | 0% / 100% / 0% | 2 | 708 | 708 | 0 / 216 | 0.305 | 461 | None | 3 | 51 | 544ms | 54ms |
| [cosmos/cosmos-sdk](https://github.com/cosmos/cosmos-sdk.git) | `06a0152` | `adr` | Apache-2.0 | 65 | 65 | 100% | 100% | 0% | 0% / 100% / 0% | 0 | 65 | 65 | 0 / 88 | 1.354 | 7 | None | 5 | 14 | 40ms | 54ms |
| [JabRef/jabref](https://github.com/JabRef/jabref.git) | `d058450` | `madr` | MIT | 88 | 88 | 100% | 100% | 9.1% | 0% / 100% / 0% | 0 | 88 | 88 | 0 / 25 | 0.284 | 60 | None | 4 | 12 | 55ms | 50ms |
| [alphagov/govuk-design-system-architecture](https://github.com/alphagov/govuk-design-system-architecture.git) | `89854bd` | `nygard` | MIT | 12 | 12 | 100% | 100% | 0% | 0% / 100% / 0% | 0 | 12 | 12 | 0 / 4 | 0.333 | 6 | None | 0 | 0 | 11ms | 59ms |

*Column notes:*
- **Real Title %**: % of parsed files whose extracted title is not the parser fallback `'Untitled ADR'`.
- **Status Found %**: % of parsed files with an explicit `status`, `stage`, or `state` key in YAML frontmatter (the parser defaults missing frontmatter status to `'accepted'`).
- **ID Source (FM / File / Gen)**: % of parsed files whose ID came from YAML frontmatter (`FM`), filename fallback (`File`), or random generation (`Gen`).
- **Duplicate IDs**: Count of parsed files whose initial ID collided with another file before relative-path disambiguation.
- **Unique IDs**: Count of distinct node IDs in `DAGEngine`'s graph after disambiguation.
- **Edges (Hard / Soft)**: Active intra-repo edges split into hard dependencies (frontmatter `depends_on` / `supersedes` or status `Supersedes ADR-XXXX`) and soft references (body markdown links and ID tokens).
- **Hard Cycles / Mutual Refs**: Hard cycles fail `ndag validate`; soft mutual references are informational only.
- **Checkout Time (cached)**: Time to verify/checkout the pinned commit SHA from the local `.corpus/` cache (50–60 ms reflects cached local checkouts, not fresh network clones).

### Link Resolution & Before/After Comparison (Phase 2C-1)

| Repository | Resolved Links | Non-Decision Links | Truly Broken Links | Edges (Before → After) | Broken Links (Before → After) |
| :--- |:---:|:---:|:---:|:---:|:---:|
| **backstage/backstage** | 4 | 1 | 0 | 0 → 4 | 4 → 0 |
| **adr/madr** | 4 | 4 | 0 | 3 → 4 | 0 → 0 |
| **rust-lang/rfcs** | 13 | 1 | 21 | 0 → 12 | 4 → 21 |
| **kubernetes/enhancements** | 254 | 165 | 51 | 0 → 216 | 93 → 51 |
| **cosmos/cosmos-sdk** | 137 | 0 | 14 | 0 → 88 | 92 → 14 |
| **JabRef/jabref** | 39 | 6 | 12 | 12 → 25 | 4 → 12 |
| **alphagov/govuk-design-system-architecture** | 5 | 0 | 0 | 0 → 4 | 4 → 0 |

*Notes:*
- **Resolved Links**: Relative Markdown links resolved by file path to a decision node in the same repository (creating soft edges).
- **Non-Decision Links**: Relative Markdown links whose target exists on disk (e.g., `PROCESS.md`, images, diagrams) but is not a decision node.
- **Truly Broken Links**: Missing decision targets (plus any unresolved hard/ID references); external `http(s)` links are excluded.

---

## 3. Observed Metrics

### Parse Failures Observed

No unhandled parse failures were recorded across the analyzed files.


### Graph Connectivity & Isolated Nodes
- Across the 7 repositories, measured edge density ranges from **0.018** to **1.354** edges per node, with **1186** of **1565** nodes having zero incoming and zero outgoing edges.

### Unresolved References (Broken Links)
- **98** dependency targets could not be matched to any parsed node ID in the same repository. Samples (up to 10 per repository, with source file path and raw link text) are recorded in `results/evidence.json`.

### Hard Cycles vs. Soft Mutual References
- The DAG engine flagged **0** repository(ies) with hard circular dependencies and **14** soft mutual reference pair(s) (see-also body links recorded in `results/evidence.json`).

---

## 4. Limitations

1. **Silent Parser Defaults:** `parseADRContent()` defaults missing `status` to `'accepted'` and missing `title` to `'Untitled ADR'`, and falls back to filename-derived IDs when frontmatter `id` is absent. Without separate extraction-quality metrics, `Parsed OK` alone overstates structured metadata coverage.
2. **Unvalidated Broken Links:** Broken links reflect raw parser/engine output and have not yet been manually verified as true positives vs. relative links to non-ADR files.
3. **Non-ADR Markdown Files:** Subfolders may contain index or template files (e.g., `README.md`, templates) that are included in `Files Found` and assigned fallback IDs.

---

## 5. Manual Validation

Review the raw evidence in `results/evidence.json` and check off each item once verified:

### Detected Cycles
- [ ] No cycles detected

### Broken Link Samples
- [ ] **rust-lang/rfcs** — Review sample of 10 of 21 broken link(s) in `results/evidence.json`
- [ ] **kubernetes/enhancements** — Review sample of 10 of 51 broken link(s) in `results/evidence.json`
- [ ] **cosmos/cosmos-sdk** — Review sample of 10 of 14 broken link(s) in `results/evidence.json`
- [ ] **JabRef/jabref** — Review sample of 10 of 12 broken link(s) in `results/evidence.json`

---

## 6. Evaluated and Excluded Repositories

| Repository | License | Status | Reason |
| :--- | :--- | :---: | :--- |
| [python/peps](https://github.com/python/peps.git) | CC0-1.0 / Public Domain | **Dropped** | PEPs in python/peps are authored in reStructuredText (.rst) format (e.g. pep-0008.rst), not Markdown (.md or .mdx). NirnayDAG is designed for Markdown-based decision records and cannot parse .rst files without format changes. |
| [joelparkerhenderson/architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record.git) | MIT | **Dropped** | This repository is an educational compilation and template directory containing over 35,000 localized translation files and guides rather than an active engineering project's architectural decision record DAG. |

---

## 7. Licensing & Research Notice

All repositories listed are publicly hosted open-source projects analyzed under their respective open-source licenses for evaluation and research purposes. NirnayDAG benchmarks local clones and does not redistribute repository contents.
