import { describe, it, expect } from 'vitest';
import {
  parseADRMarkdown,
  parseADRContent,
  parseBatchADRs,
  deriveFallbackId,
  disambiguateDuplicateIds,
} from '../src/core/adrParser.js';

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

describe('deriveFallbackId and disambiguateDuplicateIds (Phase 2C-1)', () => {
  it('derives parent directory ID for generic filenames README.md and index.md', () => {
    expect(deriveFallbackId('keps/sig-api/1027-api-unions/README.md')).toBe('1027-api-unions');
    expect(deriveFallbackId('docs/architecture/index.md')).toBe('architecture');
    expect(deriveFallbackId('docs/architecture/INDEX.MDX')).toBe('architecture');
    expect(deriveFallbackId('README.md')).toBe('README');
    expect(deriveFallbackId('0001-base.md')).toBe('ADR-0001');
    expect(deriveFallbackId('docs/adr-004-keys.md')).toBe('adr-004-keys');
  });

  it('uses deriveFallbackId in parseBatchADRs for KEP-style README.md files', () => {
    const parsed = parseBatchADRs([
      {
        name: 'README.md',
        filePath: 'keps/sig-api/1027-api-unions/README.md',
        content: '# API Unions\n',
      },
      {
        name: 'README.md',
        filePath: 'keps/sig-node/2001-node-feature/README.md',
        content: '# Node Feature\n',
      },
    ]);
    expect(parsed.map((p) => p.frontmatter.id)).toEqual(['1027-api-unions', '2001-node-feature']);
  });

  it('disambiguates colliding IDs by relative filePath and reports collision count', () => {
    const parsed = parseBatchADRs([
      { name: 'README.md', filePath: 'sig-a/1027-shared/README.md', content: '# A\n' },
      { name: 'README.md', filePath: 'sig-b/1027-shared/README.md', content: '# B\n' },
    ]);
    const { duplicateIdsCount } = disambiguateDuplicateIds(parsed);
    expect(duplicateIdsCount).toBe(2);
    expect(parsed[0].frontmatter.id).toBe('1027-shared');
    expect(parsed[1].frontmatter.id).toBe('1027-shared::sig-b/1027-shared/README.md');
  });
});

describe('parseADRContent affects frontmatter (Phase 4)', () => {
  it('parses valid affects glob list and normalizes backslashes', () => {
    const markdown = `---
id: ADR-0020
title: Auth Boundaries
status: accepted
affects:
  - "src/auth/**"
  - "services\\\\pay\\\\*.ts"
  - "./src/session/index.ts"
---
## Context
Governs auth.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.affects).toEqual([
      'src/auth/**',
      'services/pay/*.ts',
      'src/session/index.ts',
    ]);
    expect(parsed.warnings ?? []).toEqual([]);
  });

  it('omits affects when not specified', () => {
    const markdown = `---
id: ADR-0021
title: No Affects
status: accepted
---
## Context
No affects field.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.affects).toBeUndefined();
    expect(parsed.warnings ?? []).toEqual([]);
  });

  it('emits a parse warning without crashing when affects is not an array', () => {
    const markdown = `---
id: ADR-0022
title: Invalid Affects Scalar
status: accepted
affects: "src/auth/**"
---
## Context
Invalid scalar affects.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.affects).toEqual([]);
    expect(parsed.warnings?.some((w) => w.includes('affects'))).toBe(true);
  });

  it('emits a parse warning and filters non-string or empty entries in affects', () => {
    const markdown = `---
id: ADR-0023
title: Mixed Affects Array
status: accepted
affects:
  - "src/auth/**"
  - 123
  - ""
  - null
  - "src/users/*.ts"
---
## Context
Mixed affects entries.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.affects).toEqual(['src/auth/**', 'src/users/*.ts']);
    expect(parsed.warnings?.some((w) => w.includes('affects'))).toBe(true);
  });

  it('parses YAML frontmatter containing a list, nested values, and a date', () => {
    const markdown = `---
id: ADR-0024
title: Structured YAML Test
status: accepted
date: 2026-01-15
tags:
  - core
  - security
deciders:
  - Alice
  - Bob
metadata:
  owner: platform
  tier: 1
---
## Context
Testing list, nested map, and date parsing with patched js-yaml.
`;
    const parsed = parseADRContent(markdown);
    expect(parsed.frontmatter.id).toBe('ADR-0024');
    expect(parsed.frontmatter.tags).toEqual(['core', 'security']);
    expect(parsed.frontmatter.deciders).toEqual(['Alice', 'Bob']);
    expect(parsed.frontmatter.date).toBeTruthy();
  });
});

describe('Status extraction and statusSource (Phase 2C-2b Step 1)', () => {
  it('extracts status from YAML frontmatter (status/stage/state) with statusSource=frontmatter', () => {
    const parsed = parseADRContent(`---
id: ADR-101
title: Frontmatter Status
stage: draft
---
## Context
Test
`);
    expect(parsed.frontmatter.status).toBe('proposed');
    expect(parsed.statusSource).toBe('frontmatter');
  });

  it('extracts status from Nygard "## Status" section with statusSource=section', () => {
    const parsed = parseADRContent(`# Use PostgreSQL

## Status

Superseded by [ADR-0010](./0010-mysql.md)

## Context
Some context.
`, 'ADR-102');
    expect(parsed.frontmatter.status).toBe('superseded');
    expect(parsed.statusSource).toBe('section');
  });

  it('extracts status from MADR/metadata line ("Status: Accepted" or "* Status: accepted") with statusSource=line', () => {
    const parsedBullet = parseADRContent(`# Use Vitest

* Status: deprecated

## Context and Problem Statement
Test
`, 'ADR-103');
    expect(parsedBullet.frontmatter.status).toBe('deprecated');
    expect(parsedBullet.statusSource).toBe('line');

    const parsedBold = parseADRContent(`# Browser Support

**Status:** Rejected

## Context
Test
`, 'ADR-104');
    expect(parsedBold.frontmatter.status).toBe('rejected');
    expect(parsedBold.statusSource).toBe('line');
  });

  it('defaults missing status to accepted with statusSource=default', () => {
    const parsed = parseADRContent(`# No Status ADR

## Context
Just context, no status anywhere.
`, 'ADR-105');
    expect(parsed.frontmatter.status).toBe('accepted');
    expect(parsed.statusSource).toBe('default');
  });
});

describe('Title extraction and titleSource (Phase 2C-2b Step 2)', () => {
  it('extracts title from YAML frontmatter with titleSource=frontmatter', () => {
    const parsed = parseADRContent(`---
id: ADR-201
title: Frontmatter Title
---
# Heading Title
`, 'ADR-201');
    expect(parsed.frontmatter.title).toBe('Frontmatter Title');
    expect(parsed.titleSource).toBe('frontmatter');
  });

  it('extracts title from first H1 heading with titleSource=heading', () => {
    const parsed = parseADRContent(`# Heading Title

## Context
No frontmatter title.
`, 'ADR-202');
    expect(parsed.frontmatter.title).toBe('Heading Title');
    expect(parsed.titleSource).toBe('heading');
  });

  it('extracts title from RFC metadata line ("- Feature Name: foo") with titleSource=metadata-line', () => {
    const parsed = parseADRContent(`- Feature Name: nonzeroing_dynamic_drop
- Start Date: 2014-09-24
- RFC PR: [rust-lang/rfcs#320](https://github.com/rust-lang/rfcs/pull/320)

## Summary
Summary text.
`, 'ADR-0320');
    expect(parsed.frontmatter.title).toBe('nonzeroing_dynamic_drop');
    expect(parsed.titleSource).toBe('metadata-line');
  });

  it('falls back to filename slug with titleSource=slug when fallbackId is provided', () => {
    const parsed = parseADRContent(`- Start Date: 2014-03-11
- RFC PR: [rust-lang/rfcs#1](https://github.com/rust-lang/rfcs/pull/1)

## Summary
No H1 and no Feature Name.
`, '0001-private-fields');
    expect(parsed.frontmatter.title).toBe('0001-private-fields');
    expect(parsed.titleSource).toBe('slug');
  });

  it('falls back to Untitled ADR with titleSource=default when no title or fallbackId exists', () => {
    const parsed = parseADRContent(`## Summary
No title and no fallbackId.
`);
    expect(parsed.frontmatter.title).toBe('Untitled ADR');
    expect(parsed.titleSource).toBe('default');
  });
});

describe('KEP adapter (Phase 2C-2b Step 3)', () => {
  it('extracts title, status, owning-sig tag, kep-number, hard replaces/superseded-by edges, and soft see-also edges from sibling kep.yaml', () => {
    const parsed = parseBatchADRs([
      {
        name: 'README.md',
        filePath: 'sig-api/100-base/README.md',
        content: '# Base API KEP\n\n## Summary\nBase\n',
      },
      {
        name: 'kep.yaml',
        filePath: 'sig-api/100-base/kep.yaml',
        content: `title: Base API
kep-number: 100
owning-sig: sig-api
status: implemented
see-also:
  - "/sig-api/150-related/README.md"
`,
      },
      {
        name: 'README.md',
        filePath: 'sig-api/150-related/README.md',
        content: '# Related API KEP\n',
      },
      {
        name: 'kep.yaml',
        filePath: 'sig-api/150-related/kep.yaml',
        content: `title: Related API
kep-number: 150
owning-sig: sig-api
status: provisional
`,
      },
      {
        name: 'README.md',
        filePath: 'sig-api/200-replacement/README.md',
        content: '# Replacement API KEP\n',
      },
      {
        name: 'kep.yaml',
        filePath: 'sig-api/200-replacement/kep.yaml',
        content: `title: Replacement API
kep-number: 200
owning-sig: sig-api
status: implementable
replaces:
  - "/sig-api/100-base/README.md"
  - "https://example.com/external-doc"
superseded-by:
  - "150"
`,
      },
    ]);

    expect(parsed.length).toBe(3);

    const base = parsed.find((p) => p.frontmatter.id === '100-base')!;
    expect(base.frontmatter.title).toBe('Base API');
    expect(base.titleSource).toBe('kep-yaml');
    expect(base.frontmatter.status).toBe('accepted');
    expect(base.statusSource).toBe('kep-yaml');
    expect(base.frontmatter.tags).toContain('sig-api');
    expect(base.kepNumber).toBe(100);
    expect(base.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: '150-related', kind: 'soft', source: 'kep:see-also' }),
      ])
    );

    const related = parsed.find((p) => p.frontmatter.id === '150-related')!;
    expect(related.frontmatter.status).toBe('proposed');
    expect(related.statusSource).toBe('kep-yaml');

    const replacement = parsed.find((p) => p.frontmatter.id === '200-replacement')!;
    expect(replacement.frontmatter.status).toBe('proposed');
    expect(replacement.frontmatter.supersedes).toEqual(expect.arrayContaining(['100-base', '150-related']));
    expect(replacement.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetId: '100-base', kind: 'hard', source: 'kep:replaces' }),
        expect.objectContaining({ targetId: '150-related', kind: 'hard', source: 'kep:superseded-by' }),
      ])
    );
    // External URL should not become a broken internal edge
    expect(replacement.edges?.some((e) => e.targetId.includes('example.com'))).toBe(false);
  });

  it('maps all KEP statuses (provisional, implementable, implemented, deferred, rejected, withdrawn, replaced) to canonical states', () => {
    const statuses = [
      ['provisional', 'proposed'],
      ['implementable', 'proposed'],
      ['implemented', 'accepted'],
      ['deferred', 'proposed'],
      ['rejected', 'rejected'],
      ['withdrawn', 'deprecated'],
      ['replaced', 'superseded'],
    ] as const;

    const files = statuses.flatMap(([kepStatus], idx) => [
      {
        name: 'README.md',
        filePath: `sig-test/${idx}-kep/README.md`,
        content: '# Placeholder\n',
      },
      {
        name: 'kep.yaml',
        filePath: `sig-test/${idx}-kep/kep.yaml`,
        content: `title: KEP ${idx}\nkep-number: ${idx}\nstatus: ${kepStatus}\n`,
      },
    ]);

    const parsed = parseBatchADRs(files);
    expect(parsed.map((p) => p.frontmatter.status)).toEqual(statuses.map(([, expected]) => expected));
  });
});
