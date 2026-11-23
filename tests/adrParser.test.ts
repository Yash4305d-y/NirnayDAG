import { describe, it, expect } from 'vitest';
import { parseADRMarkdown } from '../src/core/adrParser.js';

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
