import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { parseADRMarkdown } from '../parser/adrParser.js';
import { DAGEngine } from '../core/dagEngine.js';
import type { NirnayADR } from '../core/types.js';

const ADR_DIR = path.resolve(process.cwd(), 'adrs');

function loadLocalADRs(): NirnayADR[] {
  if (!fs.existsSync(ADR_DIR)) return [];
  const files = fs.readdirSync(ADR_DIR).filter((f) => f.endsWith('.md'));
  return files.map((file) => {
    const raw = fs.readFileSync(path.join(ADR_DIR, file), 'utf-8');
    return parseADRMarkdown(raw);
  });
}

const server = new Server(
  { name: 'nirnay-dag-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_decision_graph',
        description: 'Returns all architectural decisions and dependency edges from the project DAG.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_blast_radius',
        description: 'Calculates all downstream decisions impacted if a target ADR is modified or deprecated.',
        inputSchema: {
          type: 'object',
          properties: {
            adrId: { type: 'string', description: 'The unique ADR ID, e.g. ADR-001' },
          },
          required: ['adrId'],
        },
      },
      {
        name: 'validate_architecture_dag',
        description: 'Checks the decision graph for circular dependencies and missing prerequisite nodes.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'create_adr',
        description: 'Creates a new ADR markdown file with frontmatter and structured trade-offs.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'e.g. ADR-006' },
            title: { type: 'string' },
            category: { type: 'string', enum: ['Infrastructure', 'Database', 'AI / Engine', 'Security'] },
            status: { type: 'string', enum: ['proposed', 'accepted', 'superseded', 'deprecated'] },
            context: { type: 'string' },
            decision: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
            dependencies: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'title', 'category', 'status', 'context', 'decision'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const adrs = loadLocalADRs();
  const engine = new DAGEngine(adrs);

  switch (request.params.name) {
    case 'get_decision_graph': {
      return {
        content: [{ type: 'text', text: JSON.stringify(adrs, null, 2) }],
      };
    }

    case 'get_blast_radius': {
      const { adrId } = request.params.arguments as { adrId: string };
      const impacted = engine.getBlastRadius(adrId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ targetNode: adrId, totalImpacted: impacted.length, impactedNodes: impacted }, null, 2),
          },
        ],
      };
    }

    case 'validate_architecture_dag': {
      const validation = engine.validate();
      return {
        content: [{ type: 'text', text: JSON.stringify(validation, null, 2) }],
      };
    }

    case 'create_adr': {
      const args = request.params.arguments as any;
      if (!fs.existsSync(ADR_DIR)) fs.mkdirSync(ADR_DIR, { recursive: true });

      const fileName = `${args.id}-${args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
      const filePath = path.join(ADR_DIR, fileName);

      const content = `---
id: ${args.id}
title: "${args.title}"
category: ${args.category}
status: ${args.status}
timestamp: ${new Date().toISOString().split('T')[0]}
dependencies: ${JSON.stringify(args.dependencies || [])}
---

## Context
${args.context}

## Decision
${args.decision}

## Consequences

### Positive
${(args.pros || []).map((p: string) => `- ${p}`).join('\n')}

### Negative
${(args.cons || []).map((c: string) => `- ${c}`).join('\n')}
`;

      fs.writeFileSync(filePath, content, 'utf-8');
      return {
        content: [{ type: 'text', text: `Successfully generated ${fileName} at ${filePath}` }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NirnayDAG MCP Server running on stdio');
}

run().catch((err) => console.error(err));
