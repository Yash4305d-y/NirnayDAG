# NirnayDAG Corpus Benchmark Findings (Phase 2A.2 + 2B)

> Benchmark Executed: 2026-11-26T13:47:36.090Z  
> Runner Version: `1.0.0-phase2c.2b`  
> Scope: Hard vs. Soft dependency edge classification and Data-Integrity Fixes across pinned open-source decision-record commits.

---

## 1. Executive Summary

NirnayDAG's parser and DAG engine were run against **7 open-source repositories** pinned to exact commit SHAs across `madr`, `rfc`, `kep`, `adr`, `nygard` formats.

- **Total Decision Files Found:** 1565
- **Parsed OK:** 1565 (100%) — *see definition below*
- **Total Graph Nodes:** 1565 (1565 unique IDs; 4 files with initial ID collisions before disambiguation)
- **Total Active Graph Edges:** 629 (9 hard, 620 soft)
- **Total Isolated Nodes:** 1017
- **Unresolved References (Broken Links):** 186 (unvalidated)
- **Repositories with Hard Cycles:** 0
- **Soft Mutual References:** 36 pair(s) (informational, non-failing)

> **Definition — "Parsed OK":** A non-empty file where `parseADRContent()` did not throw and returned a non-null `ParsedADR` object with a non-empty `frontmatter.id` (whether from frontmatter, filename fallback, or generated ID). **"Parsed OK" measures parser survival, not metadata extraction quality**—which is reported separately in the extraction-quality columns immediately next to it.

### Data Quality

In Phase 2A.1, `kubernetes/enhancements` had 708 markdown files, 689 of which were named `README.md` inside KEP subdirectories. All 689 received the fallback ID `"README"`, and `DAGEngine`'s `Map` silently overwrote colliding entries—collapsing 708 files down to 19 graph nodes while the corpus report counted `mappedAdrs.length` (708) instead of the engine's actual graph size. In Phase 2A.2, this was fixed in three ways: (1) `DAGEngine` now records duplicate IDs (with every file path involved) as a validation error and `ndag validate` fails on them rather than silently overwriting; (2) the corpus analyzer derives fallback IDs for generic filenames (`README.md`, `index.md`) from their parent directory name (e.g., `keps/sig-api/1027-api-unions/README.md` → `1027-api-unions`) and disambiguates any remaining collisions by appending the relative file path; and (3) `Nodes`, `Edges`, `Isolated Nodes`, and `Edge Density` are read directly from `DAGEngine`'s graph.

---

## 2. Benchmark Results & Extraction Quality

| Repository | Commit | Format | License | Files Found | Parsed OK | Parse Rate | Real Title % | Title Source (FM / H1 / Meta / KEP / Slug) | Status Found % | Status Source (FM / Sec / Line / KEP) | ID Source (FM / File / Gen) | Duplicate IDs | Unique IDs | Nodes | Edges (Hard / Soft) | Edge Density | Isolated Nodes | Hard Cycles | Mutual Refs | Broken Links | Analysis Time | Checkout Time (cached) |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [backstage/backstage](https://github.com/backstage/backstage.git) | `b3ed969` | `madr` | Apache-2.0 | 17 | 17 | 100% | 100% | 100% / 0% / 0% / 0% / 0% | 0% | 0% / 0% / 0% / 0% | 100% / 0% / 0% | 0 | 17 | 17 | 0 / 4 | 0.235 | 12 | None | 1 | 0 | 107ms | 58ms |
| [adr/madr](https://github.com/adr/madr.git) | `ba75bb1` | `madr` | MIT | 21 | 21 | 100% | 100% | 4.8% / 95.2% / 0% / 0% / 0% | 9.5% | 4.8% / 0% / 4.8% / 0% | 0% / 100% / 0% | 0 | 21 | 21 | 0 / 4 | 0.19 | 16 | None | 1 | 0 | 64ms | 45ms |
| [rust-lang/rfcs](https://github.com/rust-lang/rfcs.git) | `f43d578` | `rfc` | MIT / Apache-2.0 | 654 | 654 | 100% | 75.7% | 0.2% / 7.3% / 68.2% / 0% / 24.3% | 0% | 0% / 0% / 0% / 0% | 0% / 100% / 0% | 2 | 654 | 654 | 0 / 12 | 0.018 | 624 | None | 0 | 21 | 347ms | 46ms |
| [kubernetes/enhancements](https://github.com/kubernetes/enhancements.git) | `cac930c` | `kep` | Apache-2.0 | 708 | 708 | 100% | 98.7% | 0% / 2% / 0% / 96.8% / 1.3% | 96.2% | 0% / 0% / 0% / 96.2% | 0% / 100% / 0% | 2 | 708 | 708 | 9 / 483 | 0.695 | 290 | None | 25 | 164 | 898ms | 54ms |
| [cosmos/cosmos-sdk](https://github.com/cosmos/cosmos-sdk.git) | `06a0152` | `adr` | Apache-2.0 | 65 | 65 | 100% | 100% | 0% / 100% / 0% / 0% / 0% | 90.8% | 0% / 90.8% / 0% / 0% | 0% / 100% / 0% | 0 | 65 | 65 | 0 / 88 | 1.354 | 7 | None | 5 | 1 | 103ms | 49ms |
| [JabRef/jabref](https://github.com/JabRef/jabref.git) | `d058450` | `madr` | MIT | 88 | 88 | 100% | 100% | 4.5% / 95.5% / 0% / 0% / 0% | 9.1% | 9.1% / 0% / 0% / 0% | 0% / 100% / 0% | 0 | 88 | 88 | 0 / 25 | 0.284 | 62 | None | 4 | 0 | 126ms | 50ms |
| [alphagov/govuk-design-system-architecture](https://github.com/alphagov/govuk-design-system-architecture.git) | `89854bd` | `nygard` | MIT | 12 | 12 | 100% | 100% | 0% / 100% / 0% / 0% / 0% | 83.3% | 0% / 0% / 83.3% / 0% | 0% / 100% / 0% | 0 | 12 | 12 | 0 / 4 | 0.333 | 6 | None | 0 | 0 | 77ms | 50ms |

*Column notes:*
- **Real Title %**: % of parsed files whose extracted title came from frontmatter, H1 heading, RFC metadata line, or `kep.yaml` (excludes filename slug and `'Untitled ADR'` fallbacks).
- **Title Source (FM / H1 / Meta / KEP / Slug)**: % breakdown by title source: YAML frontmatter (`FM`), first H1 heading (`H1`), RFC metadata line (`Meta`), `kep.yaml` (`KEP`), or filename slug (`Slug`).
- **Status Found %**: % of parsed files where `statusSource` is not `'default'` (i.e. extracted from frontmatter, `## Status` section, metadata line, or `kep.yaml`).
- **Status Source (FM / Sec / Line / KEP)**: % breakdown by status source: YAML frontmatter (`FM`), `## Status` section (`Sec`), metadata line (`Line`), or `kep.yaml` (`KEP`).
- **ID Source (FM / File / Gen)**: % of parsed files whose ID came from YAML frontmatter (`FM`), filename fallback (`File`), or random generation (`Gen`).
- **Duplicate IDs**: Count of parsed files whose initial ID collided with another file before relative-path disambiguation.
- **Unique IDs**: Count of distinct node IDs in `DAGEngine`'s graph after disambiguation.
- **Edges (Hard / Soft)**: Active intra-repo edges split into hard dependencies (frontmatter `depends_on` / `supersedes`, status `Supersedes ADR-XXXX`, or KEP `replaces` / `superseded-by`) and soft references (body markdown links, ID tokens, and KEP `see-also`).
- **Hard Cycles / Mutual Refs**: Hard cycles fail `ndag validate`; soft mutual references are informational only.
- **Checkout Time (cached)**: Time to verify/checkout the pinned commit SHA from the local `.corpus/` cache (50–60 ms reflects cached local checkouts, not fresh network clones).

### Extraction Quality Before/After Comparison (Phase 2C-2b)

| Repository | Real Title % (Before → After) | Status Found % (Before → After) | Hard Edges (Before → After) |
| :--- | :---: | :---: | :---: |
| **backstage/backstage** | 100% → 100% | 0% → 0% | 0 → 0 |
| **adr/madr** | 100% → 100% | 4.8% → 9.5% | 0 → 0 |
| **rust-lang/rfcs** | 7.5% → 75.7% | 0% → 0% | 0 → 0 |
| **kubernetes/enhancements** | 97.9% → 98.7% | 0% → 96.2% | 0 → 9 |
| **cosmos/cosmos-sdk** | 100% → 100% | 0% → 90.8% | 0 → 0 |
| **JabRef/jabref** | 100% → 100% | 9.1% → 9.1% | 0 → 0 |
| **alphagov/govuk-design-system-architecture** | 100% → 100% | 0% → 83.3% | 0 → 0 |

### Link Resolution & Before/After Comparison (Phase 2C-1.1)

| Repository | Resolved Links | Non-Decision | Outside-Scope | Ambiguous | Truly Broken Links | Edges (Before → After) | Broken Links (Before → After) |
| :--- |:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **backstage/backstage** | 4 | 0 | 1 | 0 | 0 | 0 → 4 | 4 → 0 |
| **adr/madr** | 4 | 4 | 0 | 0 | 0 | 3 → 4 | 0 → 0 |
| **rust-lang/rfcs** | 13 | 1 | 0 | 0 | 21 | 0 → 12 | 4 → 21 |
| **kubernetes/enhancements** | 254 | 165 | 0 | 0 | 164 | 0 → 492 | 93 → 164 |
| **cosmos/cosmos-sdk** | 137 | 0 | 5 | 0 | 1 | 0 → 88 | 92 → 1 |
| **JabRef/jabref** | 39 | 6 | 10 | 0 | 0 | 12 → 25 | 4 → 0 |
| **alphagov/govuk-design-system-architecture** | 5 | 0 | 0 | 0 | 0 | 0 → 4 | 4 → 0 |

*Notes:*
- **Resolved Links**: Relative Markdown links and bare ID mentions resolved to a unique decision node in the same repository (creating soft edges).
- **Non-Decision**: Relative Markdown links whose target exists inside the analyzed folder (e.g., `PROCESS.md`, images, diagrams) but is not a decision node.
- **Outside-Scope**: Relative Markdown links whose target exists in the repository's full `git ls-tree` at the pinned commit, outside the analyzed decision folder.
- **Ambiguous**: Bare ID mentions (e.g., `[ADR-020]`) matching multiple decisions; no edge is created.
- **Truly Broken Links**: Targets absent from the full repository tree (plus unresolved hard/bare-ID references); external `http(s)` links are excluded.

---

## 3. Observed Metrics

### Parse Failures Observed

No unhandled parse failures were recorded across the analyzed files.


### Graph Connectivity & Isolated Nodes
- Across the 7 repositories, measured edge density ranges from **0.018** to **1.354** edges per node, with **1017** of **1565** nodes having zero incoming and zero outgoing edges.

### Unresolved References (Broken Links)
- **186** dependency targets could not be matched to any parsed node ID in the same repository. Samples (up to 10 per repository, with source file path and raw link text) are recorded in `results/evidence.json`.

### Hard Cycles vs. Soft Mutual References
- The DAG engine flagged **0** repository(ies) with hard circular dependencies and **36** soft mutual reference pair(s) (see-also body links recorded in `results/evidence.json`).

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
- [ ] **kubernetes/enhancements** — Review sample of 10 of 164 broken link(s) in `results/evidence.json`
- [ ] **cosmos/cosmos-sdk** — Review sample of 1 of 1 broken link(s) in `results/evidence.json`

---

## 6. Evaluated and Excluded Repositories

| Repository | License | Status | Reason |
| :--- | :--- | :---: | :--- |
| [python/peps](https://github.com/python/peps.git) | CC0-1.0 / Public Domain | **Dropped** | PEPs in python/peps are authored in reStructuredText (.rst) format (e.g. pep-0008.rst), not Markdown (.md or .mdx). NirnayDAG is designed for Markdown-based decision records and cannot parse .rst files without format changes. |
| [joelparkerhenderson/architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record.git) | MIT | **Dropped** | This repository is an educational compilation and template directory containing over 35,000 localized translation files and guides rather than an active engineering project's architectural decision record DAG. |

---

## 7. Licensing & Research Notice

All repositories listed are publicly hosted open-source projects analyzed under their respective open-source licenses for evaluation and research purposes. NirnayDAG benchmarks local clones and does not redistribute repository contents.
