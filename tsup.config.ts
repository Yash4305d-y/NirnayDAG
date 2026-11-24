import { defineConfig } from 'tsup';

export default defineConfig([
  // Core library and MCP server (ESM & CJS)
  {
    entry: {
      index: 'src/index.ts',
      mcp: 'src/mcp/server.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: false,
    sourcemap: true,
    banner: {
      js: `// NirnayDAG compiled output`,
    },
  },
  // CLI entry (ESM-only)
  {
    entry: {
      cli: 'src/cli/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: false,
    sourcemap: true,
    banner: {
      js: `// NirnayDAG compiled output`,
    },
  },
]);
