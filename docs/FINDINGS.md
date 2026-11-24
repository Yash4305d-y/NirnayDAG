# NirnayDAG Corpus Benchmark Findings (Phase 2B)

> Benchmark Executed: 2026-11-24T20:14:14.851Z  
> Runner Version: `1.0.0-phase2b`  
> Scope: Hard vs. Soft dependency edge classification across pinned open-source decision-record commits.

---

## 1. Executive Summary

NirnayDAG's parser and DAG engine were run against **7 open-source repositories** pinned to exact commit SHAs across `madr`, `rfc`, `kep`, `adr`, `nygard` formats.

- **Total Decision Files Found:** 1565
- **Parsed OK:** 1565 (100%) — *see definition below*
- **Total Graph Nodes:** 1565
- **Total Active Graph Edges:** 15 (0 hard, 15 soft)
- **Total Isolated Nodes:** 1514
- **Unresolved References (Broken Links):** 113 (unvalidated)
- **Repositories with Hard Cycles:** 0
- **Soft Mutual References:** 5 pair(s) (informational, non-failing)

> **Definition — "Parsed OK":** A non-empty file where `parseADRContent()` did not throw and returned a non-null `ParsedADR` object with a non-empty `frontmatter.id` (whether from frontmatter, filename fallback, or generated ID). **"Parsed OK" measures parser survival, not metadata extraction quality**—which is reported separately in the extraction-quality columns immediately next to it.

---

## 2. Benchmark Results & Extraction Quality

| Repository | Commit | Format | License | Files Found | Parsed OK | Parse Rate | Real Title % | Status Found % | ID Source (FM / File / Gen) | Nodes | Edges (Hard / Soft) | Edge Density | Isolated Nodes | Hard Cycles | Mutual Refs | Broken Links | Analysis Time | Clone Time |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [backstage/backstage](https://github.com/backstage/backstage.git) | `b3ed969` | `madr` | Apache-2.0 | 17 | 17 | 100% | 100% | 0% | 100% / 0% / 0% | 17 | 0 / 0 | 0 | 13 | None | 0 | 4 | 31ms | 82ms |
| [adr/madr](https://github.com/adr/madr.git) | `ba75bb1` | `madr` | MIT | 21 | 21 | 100% | 100% | 4.8% | 0% / 100% / 0% | 21 | 0 / 3 | 0.143 | 18 | None | 1 | 0 | 25ms | 64ms |
| [rust-lang/rfcs](https://github.com/rust-lang/rfcs.git) | `f43d578` | `rfc` | MIT / Apache-2.0 | 654 | 654 | 100% | 7.5% | 0% | 0% / 100% / 0% | 654 | 0 / 0 | 0 | 651 | None | 0 | 4 | 730ms | 64ms |
| [kubernetes/enhancements](https://github.com/kubernetes/enhancements.git) | `cac930c` | `kep` | Apache-2.0 | 708 | 708 | 100% | 97.9% | 0% | 0% / 100% / 0% | 708 | 0 / 0 | 0 | 705 | None | 0 | 5 | 675ms | 81ms |
| [cosmos/cosmos-sdk](https://github.com/cosmos/cosmos-sdk.git) | `06a0152` | `adr` | Apache-2.0 | 65 | 65 | 100% | 100% | 0% | 0% / 100% / 0% | 65 | 0 / 0 | 0 | 45 | None | 0 | 92 | 72ms | 71ms |
| [JabRef/jabref](https://github.com/JabRef/jabref.git) | `d058450` | `madr` | MIT | 88 | 88 | 100% | 100% | 9.1% | 0% / 100% / 0% | 88 | 0 / 12 | 0.136 | 73 | None | 4 | 4 | 98ms | 66ms |
| [alphagov/govuk-design-system-architecture](https://github.com/alphagov/govuk-design-system-architecture.git) | `89854bd` | `nygard` | MIT | 12 | 12 | 100% | 100% | 0% | 0% / 100% / 0% | 12 | 0 / 0 | 0 | 9 | None | 0 | 4 | 17ms | 73ms |

*Column notes:*
- **Real Title %**: % of parsed files whose extracted title is not the parser fallback `'Untitled ADR'`.
- **Status Found %**: % of parsed files with an explicit `status`, `stage`, or `state` key in YAML frontmatter (the parser defaults missing frontmatter status to `'accepted'`).
- **ID Source (FM / File / Gen)**: % of parsed files whose ID came from YAML frontmatter (`FM`), filename fallback (`File`), or random generation (`Gen`).
- **Edges (Hard / Soft)**: Active intra-repo edges split into hard dependencies (frontmatter `depends_on` / `supersedes` or status `Supersedes ADR-XXXX`) and soft references (body markdown links and ID tokens).
- **Hard Cycles / Mutual Refs**: Hard cycles fail `ndag validate`; soft mutual references are informational only.

---

## 3. Observed Metrics

### Parse Failures Observed

No unhandled parse failures were recorded across the analyzed files.


### Graph Connectivity & Isolated Nodes
- Across the 7 repositories, measured edge density ranges from **0** to **0.143** edges per node, with **1514** of **1565** nodes having zero incoming and zero outgoing edges.

### Unresolved References (Broken Links)
- **113** dependency targets could not be matched to any parsed node ID in the same repository. Samples (up to 10 per repository, with source file path and raw link text) are recorded in `results/evidence.json`.

### Hard Cycles vs. Soft Mutual References
- The DAG engine flagged **0** repository(ies) with hard circular dependencies and **5** soft mutual reference pair(s) (see-also body links recorded in `results/evidence.json`).

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
- [ ] **backstage/backstage** — Review sample of 4 of 4 broken link(s) in `results/evidence.json`
- [ ] **rust-lang/rfcs** — Review sample of 4 of 4 broken link(s) in `results/evidence.json`
- [ ] **kubernetes/enhancements** — Review sample of 5 of 5 broken link(s) in `results/evidence.json`
- [ ] **cosmos/cosmos-sdk** — Review sample of 10 of 92 broken link(s) in `results/evidence.json`
- [ ] **JabRef/jabref** — Review sample of 4 of 4 broken link(s) in `results/evidence.json`
- [ ] **alphagov/govuk-design-system-architecture** — Review sample of 4 of 4 broken link(s) in `results/evidence.json`

---

## 6. Evaluated and Excluded Repositories

| Repository | License | Status | Reason |
| :--- | :--- | :---: | :--- |
| [python/peps](https://github.com/python/peps.git) | CC0-1.0 / Public Domain | **Dropped** | PEPs in python/peps are authored in reStructuredText (.rst) format (e.g. pep-0008.rst), not Markdown (.md or .mdx). NirnayDAG is designed for Markdown-based decision records and cannot parse .rst files without format changes. |
| [joelparkerhenderson/architecture-decision-record](https://github.com/joelparkerhenderson/architecture-decision-record.git) | MIT | **Dropped** | This repository is an educational compilation and template directory containing over 35,000 localized translation files and guides rather than an active engineering project's architectural decision record DAG. |

---

## 7. Licensing & Research Notice

All repositories listed are publicly hosted open-source projects analyzed under their respective open-source licenses for evaluation and research purposes. NirnayDAG benchmarks local clones and does not redistribute repository contents.
