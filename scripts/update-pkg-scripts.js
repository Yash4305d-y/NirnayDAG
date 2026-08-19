import fs from 'fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts = {
  ...pkg.scripts,
  "dev": "vite",
  "build": "tsup && vite build",
  "start": "vite preview",
  "cli:validate": "node ./bin/ndag.js validate",
  "cli:blast": "node ./bin/ndag.js blast",
  "mcp:start": "node ./dist/mcp.js",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "prepublishOnly": "npm run typecheck && npm run build"
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
