import fs from 'fs';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.name = 'nirnay-dag';
pkg.private = false;
pkg.version = '0.1.0';

pkg.bin = {
  "ndag": "./bin/ndag.js"
};

pkg.exports = {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./core": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./mcp": {
    "types": "./dist/mcp.d.ts",
    "import": "./dist/mcp.js",
    "require": "./dist/mcp.cjs"
  }
};

pkg.scripts = {
  ...pkg.scripts,
  "build": "tsup",
  "dev": "tsup --watch",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "prepublishOnly": "npm run typecheck && npm run build"
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
