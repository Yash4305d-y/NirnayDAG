import fs from 'fs';
import path from 'path';

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      fixImports(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      content = content.replace(/from\s+['"](\.[^'"]+)['"]/g, (match, p1) => {
        if (p1.endsWith('.js') || p1.endsWith('.css') || p1.endsWith('.svg')) return match;
        return `from '${p1}.js'`;
      });
      content = content.replace(/import\s+['"](\.[^'"]+)['"]/g, (match, p1) => {
        if (p1.endsWith('.js') || p1.endsWith('.css') || p1.endsWith('.svg')) return match;
        return `import '${p1}.js'`;
      });
      fs.writeFileSync(fullPath, content);
    }
  }
}

fixImports('./src');
