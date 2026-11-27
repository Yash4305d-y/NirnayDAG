# NirnayDAG Risk Model (v2)

## What the Score Means

Risk Model v2 produces a structural blast-radius score on a **0–100** scale for any decision node in the Architecture Decision Graph, computed **exclusively from hard dependency edges** (`depends_on`, `supersedes`, and explicit `Supersedes ADR-XXXX` declarations). Soft body references (`body:link`, `body:id`) are excluded so editorial cross-references do not inflate structural risk.

| Score Range | Risk Level | Interpretation |
| :--- | :--- | :--- |
| `0 – 30` | **Low** | Local or leaf decision with minimal downstream coupling. |
| `31 – 60` | **Medium** | Moderately coupled decision; changes require reviewing direct and transitive dependents. |
| `61 – 100` | **High** | Central or foundational decision whose deprecation/modification affects a large fraction of the graph or critical shortest paths. |

The legacy v1 heuristic (`direct * 5 + cascade * 10`) remains available behind `version: 'v1'` in `calculateArchitectureRisk()`. Category-based weights (e.g., `Infrastructure`, `Security`) are not used.

---

## Factors & Formula

Given a graph with $N$ nodes and hard-edge adjacency list, each factor is normalized to $[0, 1]$:

1. **Direct Dependents (`directDependents`, default weight `0.30`)**
   - $\text{directNorm} = \min\left(1, \frac{\text{directCount}}{\max(1, N - 1)}\right)$
   - *Why chosen:* Measures immediate coupling—how many decisions break or require re-evaluation directly when this decision changes.

2. **Cascade Fraction (`cascadeFraction`, default weight `0.35`)**
   - $\text{cascadeFraction} = \min\left(1, \frac{\text{cascadeCount}}{\max(1, N - 1)}\right)$
   - *Why chosen:* Measures total transitive blast radius relative to the whole graph rather than an unscaled raw count, making scores comparable across small and large repositories.

3. **Longest Dependency Depth (`longestDepth`, default weight `0.15`)**
   - $\text{depthNorm} = \min\left(1, \frac{\text{depth}}{\text{depthSaturation}}\right)$ (default `depthSaturation = 10`)
   - *Why chosen:* Deeper dependency chains increase coordination cost and the likelihood of subtle cascading assumptions.

4. **Betweenness Centrality (`betweennessCentrality`, default weight `0.20`)**
   - Computed via **Brandes' algorithm** on the unweighted directed hard-edge graph, normalized by $(N - 1)(N - 2)$ for $N > 2$.
   - *Why chosen:* Identifies architectural "bridge" or bottleneck decisions that sit on many shortest dependency paths between other decisions, even if their direct degree is modest.

### Combined Score

$$\text{score} = \text{clamp}_{[0, 100]}\Big(\text{round}_{0.1}\big(100 \cdot (w_d \cdot \text{directNorm} + w_c \cdot \text{cascadeFraction} + w_l \cdot \text{depthNorm} + w_b \cdot \text{betweennessCentrality})\big)\Big)$$

All weights and saturation constants are exposed via `DEFAULT_RISK_V2_CONFIG` and can be overridden per call.

---

## Algorithm Complexity & Large-Graph Fallback

- **Exact Brandes' Algorithm ($N \le 5{,}000$):** Runs in $O(V \cdot E)$ time and $O(V + E)$ space.
- **Large-Graph Fallback ($N > 5{,}000$):** Exact betweenness becomes expensive on graphs exceeding `MAX_EXACT_BETWEENNESS_NODES` (`5,000`). Above this threshold, `computeBetweennessCentrality` automatically switches to deterministic pivot sampling (`betweennessSampleSize = 256` evenly spaced nodes, scaled by $N / k$), running in $O(k \cdot (V + E))$ time and reporting `betweennessMode: 'sampled'` in the breakdown.

---

## Honest Limitations

1. **Structural heuristic, not a failure prediction:** The score measures *documented graph topology*, not runtime outage probability, code churn, or team ownership boundaries.
2. **Depends on edge hygiene:** Repositories that only link ADRs in prose (soft links) or omit `depends_on` / `supersedes` frontmatter will show low or zero v2 scores.
3. **Equal edge weight:** All hard edges are treated equally; a minor configuration dependency and a core database choice carry the same topological weight.
4. **Sensitivity to graph size:** Because `directDependents` and `cascadeFraction` normalize by $N - 1$, adding many isolated/unrelated ADRs reduces the relative fraction of existing hubs.
