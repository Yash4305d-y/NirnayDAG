import { describe, it, expect } from 'vitest';
import { parseADRMarkdown, parseADRContent } from '../src/core/adrParser.js';

describe('ADR Parser', () => {
  it('should parse a standard Markdown ADR correctly', () => {
    const markdown = `---
id: ADR-001
title: Test Title
category: Security
status: accepted
timestamp: 2026-05-05
dependencies: ["ADR-000"]
---
## Context
This is the context.
## Decision
This is the decision.
## Consequences
### Positive
- Pro 1
- Pro 2
### Negative
- Con 1
`;
    const adr = parseADRMarkdown(markdown);
    expect(adr.id).toBe('ADR-001');
    expect(adr.title).toBe('Test Title');
    expect(adr.context).toContain('This is the context.');
    expect(adr.decision).toContain('This is the decision.');
    expect(adr.consequences.pros).toEqual(['Pro 1', 'Pro 2']);
    expect(adr.consequences.cons).toEqual(['Con 1']);
  });

  it('should handle case-insensitive headers', () => {
    const markdown = `---
id: ADR-002
title: Test
category: Infrastructure
status: proposed
timestamp: 2026-05-05
---
## CONTEXT
Context block.
## decision
Decision block.
## CONSEQUENCES
### Pros
- Pro A
### Cons
- Con A
`;
    const adr = parseADRMarkdown(markdown);
    expect(adr.context).toContain('Context block.');
    expect(adr.decision).toContain('Decision block.');
    expect(adr.consequences.pros).toEqual(['Pro A']);
    expect(adr.consequences.cons).toEqual(['Con A']);
  });

  it('should handle alternative consequence headers', () => {
    const markdown = `---
id: ADR-003
title: Test
category: Infrastructure
status: proposed
timestamp: 2026-05-05
---
## Context
Ctx
## Decision
Dec
## Consequences
### Benefits
- Ben 1
### Drawbacks
- Draw 1
`;
    const adr = parseADRMarkdown(markdown);
    expect(adr.consequences.pros).toEqual(['Ben 1']);
    expect(adr.consequences.cons).toEqual(['Draw 1']);
  });

  it('should throw on malformed YAML / Missing Frontmatter', () => {
    const markdown = `
# ADR-001
No frontmatter here.
`;
    expect(() => parseADRMarkdown(markdown)).toThrowError(/Invalid ADR format/);
  });
});

describe('parseADRContent edge kinds and provenance (Phase 2B)', () => {
  it('extracts hard edges with frontmatter provenance for frontmatter-only ADRs', () => {
    const markdown = `---
id: ADR-0002
title: Use Kafka
status: accepted
depends_on:
  - ADR-0001
supersedes:
  - ADR-0000
---
## Context
Pure frontmatter dependencies.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.depends_on).toEqual(['ADR-0001']);
    expect(parsed.frontmatter.supersedes).toEqual(['ADR-0000']);
    expect(parsed.edges).toEqual([
      { targetId: 'ADR-0001', kind: 'hard', source: 'frontmatter:depends_on', rawText: 'depends_on: ADR-0001' },
      { targetId: 'ADR-0000', kind: 'hard', source: 'frontmatter:supersedes', rawText: 'supersedes: ADR-0000' },
    ]);
  });

  it('extracts hard edge from explicit "Supersedes ADR-XXXX" status line', () => {
    const markdown = `---
id: ADR-0005
title: Replace Legacy Auth
status: accepted
---
## Status
Supersedes ADR-0003

## Context
Replaces old auth.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.supersedes).toContain('ADR-0003');
    expect(parsed.edges).toEqual([
      { targetId: 'ADR-0003', kind: 'hard', source: 'status:supersedes', rawText: 'Supersedes ADR-0003' },
    ]);
  });

  it('extracts soft edges from markdown links and ID tokens for body-only ADRs', () => {
    const markdown = `# 0008 Add Status Field

## More Information
See [ADR-0013] and [Format](./0014-format.md) for details.
`;
    const parsed = parseADRContent(markdown, 'ADR-0008');
    expect(parsed.frontmatter.depends_on).toEqual([]);
    expect(parsed.edges).toEqual([
      { targetId: 'ADR-0013', kind: 'soft', source: 'body:id', rawText: '[ADR-0013]' },
      { targetId: 'ADR-0014-format', kind: 'soft', source: 'body:link', rawText: '(./0014-format.md)' },
    ]);
  });

  it('extracts both hard frontmatter edges and soft body edges for mixed ADRs', () => {
    const markdown = `---
id: ADR-0010
title: Mixed ADR
status: accepted
depends_on:
  - ADR-0001
---
## Context
Builds on ADR-0001 and relates to [ADR-0008] and [Other](./0009-other.md).
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.depends_on).toEqual(['ADR-0001']);
    expect(parsed.edges).toEqual([
      { targetId: 'ADR-0001', kind: 'hard', source: 'frontmatter:depends_on', rawText: 'depends_on: ADR-0001' },
      { targetId: 'ADR-0008', kind: 'soft', source: 'body:id', rawText: '[ADR-0008]' },
      { targetId: 'ADR-0009-other', kind: 'soft', source: 'body:link', rawText: '(./0009-other.md)' },
    ]);
  });
});
