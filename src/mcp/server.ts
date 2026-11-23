import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs-extra';
import path from 'path';
import glob from 'fast-glob';
import { parseADRContent } from '../core/adrParser.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';
import { calculateArchitectureRisk } from '../core/risk.js';
import type { ParsedADR } from '../core/types.js';

const server = new Server(
  { name: "nirnay-dag-mcp", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } }
);

function loadAdrs(): ParsedADR[] {
  const adrDir = process.env.ADR_DIR || process.argv[2] || './docs/adr';
  let resolvedDir = adrDir;
  
  if (!path.isAbsolute(adrDir)) {
    resolvedDir = path.join(process.cwd(), adrDir);
    if (!fs.existsSync(resolvedDir)) {
       resolvedDir = path.join(process.cwd(), './sample-adrs');
    }
  }

  if (!fs.existsSync(resolvedDir)) {
    return [];
  }

  const files = glob.sync("**/*.{md,markdown}", { cwd: resolvedDir, absolute: true });
  const adrs: ParsedADR[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    try {
      const baseNameMatch = path.basename(file).match(/^(\d+)/);
      let fallbackId = path.basename(file).replace(/\.mdx?$/, '');
      if (baseNameMatch) {
        fallbackId = `ADR-${baseNameMatch[1]}`;
      }
      adrs.push(parseADRContent(content, fallbackId));
    } catch (e) {
      console.error(`Failed to parse ${file}`, e);
    }
  }
  return adrs;
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_adrs',
        description: 'List Architecture Decision Records (ADRs).',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Filter by status (e.g. accepted, proposed)' },
            tag: { type: 'string', description: 'Filter by tag' }
          }
        }
      },
      {
        name: 'get_adr_context',
        description: 'Get full Markdown details including Context, Decision, Consequences, and Deciders.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ADR ID (e.g. ADR-0001)' }
          },
          required: ['id']
        }
      },
      {
        name: 'query_blast_radius',
        description: 'Query downstream cascading dependencies for an ADR.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ADR ID' }
          },
          required: ['id']
        }
      },
      {
        name: 'validate_architecture',
        description: 'Validate the DAG for cycles and retrieve topological order.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const adrs = loadAdrs();
  const { name, arguments: args } = request.params;

  try {
    if (name === 'list_adrs') {
      let filtered = adrs;
      if (args?.status) {
        filtered = filtered.filter(a => a.frontmatter.status === args.status);
      }
      if (args?.tag) {
        filtered = filtered.filter(a => a.frontmatter.tags?.includes(args.tag as string));
      }
      const result = filtered.map(a => ({
        id: a.frontmatter.id,
        title: a.frontmatter.title,
        status: a.frontmatter.status,
        tags: a.frontmatter.tags || []
      }));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }

    if (name === 'get_adr_context') {
      const id = args?.id as string;
      const adr = adrs.find(a => a.frontmatter.id === id);
      if (!adr) {
        return { content: [{ type: 'text', text: `ADR not found: ${id}` }] };
      }
      
      const details = {
        id: adr.frontmatter.id,
        title: adr.frontmatter.title,
        status: adr.frontmatter.status,
        date: adr.frontmatter.date,
        tags: adr.frontmatter.tags,
        deciders: adr.frontmatter.deciders,
        context: adr.context,
        decision: adr.decision,
        consequences: adr.consequences
      };
      
      return { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] };
    }

    if (name === 'query_blast_radius') {
      const id = args?.id as string;
      const { engine } = validateAndComputeDAG(adrs);
      const deps = engine.getBlastRadius(id);
      const direct = engine.getDirectDependents(id);
      const depth = engine.getDepth(id);
      const risk = calculateArchitectureRisk({ directDependentsCount: direct.length, cascadeCount: deps.length, depth });
      return {
        content: [{
          type: 'text', text: JSON.stringify({
            directDependents: direct,
            totalCascadingDownstream: deps,
            maxDepth: depth,
            architectureRiskScore: risk.score,
            riskLevel: risk.level,
            riskBreakdown: risk.breakdown
          }, null, 2)
        }]
      };
    }

    if (name === 'validate_architecture') {
      const { validationResult, engine } = validateAndComputeDAG(adrs);
      const rootNodes = engine.getRoots();
      
      return {
        content: [{
          type: 'text', text: JSON.stringify({
            hasCycles: validationResult.hasCycle,
            cyclePath: validationResult.cyclePath,
            missingDependencies: validationResult.missingDependencies,
            rootDecisions: rootNodes,
            topologicalOrder: validationResult.topologicalOrder
          }, null, 2)
        }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NirnayDAG MCP Server running on stdio');
}

main().catch(console.error);
