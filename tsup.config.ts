import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli/index.ts',
    index: 'src/index.ts',
    mcp: 'src/mcp/server.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  sourcemap: true,
  banner: {
    js: `// NirnayDAG compiled output`,
  }
});
