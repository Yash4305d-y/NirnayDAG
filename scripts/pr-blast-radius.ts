import { generatePRReport } from '../src/core/report.js';

async function main() {
  const adrDir = process.env.ADR_DIR || process.argv[2] || './adrs';
  await generatePRReport({ adrDir });
}

main().catch(err => {
  console.error("Failed to generate PR blast radius report", err);
  process.exit(1);
});
