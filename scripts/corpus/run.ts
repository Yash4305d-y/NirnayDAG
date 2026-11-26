#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import chalk from 'chalk';
import type {
  CorpusRegistry,
  CorpusRepoConfig,
  RepoBenchmarkResult,
  CorpusBenchmarkReport,
  RepoEvidence,
  CorpusEvidenceReport,
  ExtractionQualityMetrics,
} from './types.js';
import {
  readDirectoryDecisionFiles,
  analyzeDecisionFiles,
} from './analyzer.js';
import {
  writeCorpusResultsJson,
  writeEvidenceJson,
  writeFindingsMarkdown,
} from './reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function sanitizeRepoFolderName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function executeGit(cmd: string, cwd?: string): string {
  return execSync(cmd, {
    cwd: cwd || projectRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim();
}

const PHASE_2B_BASELINE: Record<string, { edges: number; brokenLinks: number }> = {
  'backstage/backstage': { edges: 0, brokenLinks: 4 },
  'adr/madr': { edges: 3, brokenLinks: 0 },
  'rust-lang/rfcs': { edges: 0, brokenLinks: 4 },
  'kubernetes/enhancements': { edges: 0, brokenLinks: 93 },
  'cosmos/cosmos-sdk': { edges: 0, brokenLinks: 92 },
  'JabRef/jabref': { edges: 12, brokenLinks: 4 },
  'alphagov/govuk-design-system-architecture': { edges: 0, brokenLinks: 4 },
};

const EMPTY_EXTRACTION_QUALITY: ExtractionQualityMetrics = {
  realTitleCount: 0,
  realTitlePercent: 0,
  statusFoundCount: 0,
  statusFoundPercent: 0,
  idFromFrontmatterCount: 0,
  idFromFrontmatterPercent: 0,
  idFromFilenameCount: 0,
  idFromFilenamePercent: 0,
  idGeneratedCount: 0,
  idGeneratedPercent: 0,
  edgeSourceBreakdownSupported: true,
};

export async function cloneOrUpdateRepo(
  repo: CorpusRepoConfig,
  corpusCacheDir: string
): Promise<{ repoDir: string; commitSha: string; cloneMs: number }> {
  if (!repo.commitSha || !/^[0-9a-f]{40}$/i.test(repo.commitSha)) {
    throw new Error(`Repository ${repo.name} is missing a valid pinned 40-char commitSha in corpus.json`);
  }

  const folderName = sanitizeRepoFolderName(repo.name);
  const targetDir = path.resolve(corpusCacheDir, folderName);
  const startClone = Date.now();

  await fs.ensureDir(corpusCacheDir);

  const hasGit = await fs.pathExists(path.join(targetDir, '.git'));

  if (hasGit) {
    try {
      const currentSha = executeGit('git rev-parse HEAD', targetDir);
      if (currentSha === repo.commitSha) {
        const cloneMs = Date.now() - startClone;
        return { repoDir: targetDir, commitSha: currentSha, cloneMs };
      }

      executeGit(`git fetch --depth 1 origin ${repo.commitSha}`, targetDir);
      executeGit(`git checkout --force ${repo.commitSha}`, targetDir);
      const updatedSha = executeGit('git rev-parse HEAD', targetDir);
      if (updatedSha !== repo.commitSha) {
        throw new Error(`Checked out SHA ${updatedSha} does not match pinned ${repo.commitSha}`);
      }
      const cloneMs = Date.now() - startClone;
      return { repoDir: targetDir, commitSha: updatedSha, cloneMs };
    } catch {
      // If corrupted or shallow fetch failed on existing repo, remove and re-clone
      await fs.remove(targetDir);
    }
  }

  // Attempt sparse shallow fetch of pinned commit SHA first
  try {
    await fs.ensureDir(targetDir);
    executeGit('git init', targetDir);
    executeGit(`git remote add origin "${repo.url}"`, targetDir);
    const sparseFolders = repo.subfolders.map((s) => `"${s}"`).join(' ');
    executeGit(`git sparse-checkout set ${sparseFolders}`, targetDir);
    executeGit(`git fetch --depth 1 --filter=blob:none origin ${repo.commitSha}`, targetDir);
    executeGit(`git checkout --force ${repo.commitSha}`, targetDir);
  } catch {
    // Clean up partial folder and fallback to standard shallow fetch of pinned SHA
    await fs.remove(targetDir);
    try {
      await fs.ensureDir(targetDir);
      executeGit('git init', targetDir);
      executeGit(`git remote add origin "${repo.url}"`, targetDir);
      executeGit(`git fetch --depth 1 origin ${repo.commitSha}`, targetDir);
      executeGit(`git checkout --force ${repo.commitSha}`, targetDir);
    } catch (fullCloneErr) {
      throw new Error(`Failed to fetch pinned commit ${repo.commitSha} for ${repo.name}: ${fullCloneErr}`);
    }
  }

  const commitSha = executeGit('git rev-parse HEAD', targetDir);
  if (commitSha !== repo.commitSha) {
    throw new Error(`Checked out SHA ${commitSha} does not match pinned ${repo.commitSha}`);
  }
  const cloneMs = Date.now() - startClone;

  return { repoDir: targetDir, commitSha, cloneMs };
}

export async function benchmarkSingleRepo(
  repo: CorpusRepoConfig,
  corpusCacheDir: string
): Promise<{ result: RepoBenchmarkResult; evidence: RepoEvidence }> {
  console.log(chalk.cyan(`\n[Corpus Runner] Processing ${chalk.bold(repo.name)} (${repo.format})...`));

  let repoDir = '';
  let commitSha = repo.commitSha;
  let cloneMs = 0;

  try {
    const cloneInfo = await cloneOrUpdateRepo(repo, corpusCacheDir);
    repoDir = cloneInfo.repoDir;
    commitSha = cloneInfo.commitSha;
    cloneMs = cloneInfo.cloneMs;
    console.log(chalk.gray(`  Verified pinned commit: ${commitSha.substring(0, 10)} (${cloneMs}ms)`));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`  Clone failed for ${repo.name}: ${errMsg}`));
    return {
      result: {
        repo: repo.name,
        url: repo.url,
        format: repo.format,
        license: repo.license,
        commitSha: 'failed',
        filesFound: 0,
        filesParsedOK: 0,
        parseRatePercent: 0,
        parseFailuresCount: 1,
        parseFailures: [{ file: repo.url, reason: errMsg }],
        topFailureReasons: [{ reason: errMsg, count: 1 }],
        extractionQuality: { ...EMPTY_EXTRACTION_QUALITY },
        duplicateIdsCount: 0,
        uniqueIdsCount: 0,
        nodes: 0,
        edges: 0,
        hardEdges: 0,
        softEdges: 0,
        edgeDensity: 0,
        isolatedNodes: 0,
        cyclesFound: false,
        mutualReferencesCount: 0,
        mutualReferences: [],
        brokenLinks: 0,
        missingDependencies: [],
        timing: { cloneMs, analysisMs: 0, totalMs: cloneMs },
      },
      evidence: {
        repo: repo.name,
        commitSha: 'failed',
        cycles: [],
        mutualReferences: [],
        brokenLinks: [],
      },
    };
  }

  const startAnalysis = Date.now();
  const files = await readDirectoryDecisionFiles(repoDir, repo.subfolders);
  console.log(chalk.gray(`  Found ${files.length} decision markdown files in subfolders: ${repo.subfolders.join(', ')}`));

  let repoFiles: string[] = [];
  try {
    const treeOutput = execSync(`git ls-tree -r --name-only ${commitSha}`, {
      cwd: repoDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
    repoFiles = treeOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    repoFiles = [];
  }

  const { evidence, ...metrics } = analyzeDecisionFiles(files, {
    repoDir,
    repoFiles,
    analyzedFolders: repo.subfolders,
  });
  const analysisMs = Date.now() - startAnalysis;
  const totalMs = cloneMs + analysisMs;

  console.log(
    chalk.green(
      `  Parsed OK: ${metrics.filesParsedOK}/${metrics.filesFound} (${metrics.parseRatePercent}%) | Nodes: ${metrics.nodes} | Edges: ${metrics.edges} | Resolved: ${metrics.resolvedLinks} | Non-Decision: ${metrics.nonDecisionLinks} | Broken: ${metrics.brokenLinks} (${analysisMs}ms)`
    )
  );

  return {
    result: {
      repo: repo.name,
      url: repo.url,
      format: repo.format,
      license: repo.license,
      commitSha,
      ...metrics,
      before: PHASE_2B_BASELINE[repo.name],
      timing: {
        cloneMs,
        analysisMs,
        totalMs,
      },
    },
    evidence: {
      repo: repo.name,
      commitSha,
      cycles: evidence.cycles,
      mutualReferences: evidence.mutualReferences,
      brokenLinks: evidence.brokenLinks,
    },
  };
}

export async function runCorpusBenchmark(): Promise<CorpusBenchmarkReport> {
  const corpusJsonPath = path.resolve(__dirname, 'corpus.json');
  if (!await fs.pathExists(corpusJsonPath)) {
    throw new Error(`corpus.json not found at ${corpusJsonPath}`);
  }

  const registry: CorpusRegistry = await fs.readJson(corpusJsonPath);
  const corpusCacheDir = path.resolve(projectRoot, '.corpus');
  await fs.ensureDir(corpusCacheDir);

  console.log(chalk.bold.magenta('\n======================================================'));
  console.log(chalk.bold.magenta('  NirnayDAG Corpus Benchmark Runner (Phase 2A.2 + 2B)'));
  console.log(chalk.bold.magenta('======================================================'));
  console.log(chalk.gray(`Target Repositories: ${registry.repositories.length}`));
  console.log(chalk.gray(`Cache Directory: ${corpusCacheDir}`));

  const results: RepoBenchmarkResult[] = [];
  const evidenceRepos: RepoEvidence[] = [];

  for (const repo of registry.repositories) {
    try {
      const { result, evidence } = await benchmarkSingleRepo(repo, corpusCacheDir);
      results.push(result);
      evidenceRepos.push(evidence);
    } catch (repoErr: unknown) {
      const msg = repoErr instanceof Error ? repoErr.message : String(repoErr);
      console.error(chalk.red(`Fatal repository processing error on ${repo.name}: ${msg}`));
      results.push({
        repo: repo.name,
        url: repo.url,
        format: repo.format,
        license: repo.license,
        commitSha: 'failed',
        filesFound: 0,
        filesParsedOK: 0,
        parseRatePercent: 0,
        parseFailuresCount: 1,
        parseFailures: [{ file: repo.name, reason: msg }],
        topFailureReasons: [{ reason: msg, count: 1 }],
        extractionQuality: { ...EMPTY_EXTRACTION_QUALITY },
        duplicateIdsCount: 0,
        uniqueIdsCount: 0,
        nodes: 0,
        edges: 0,
        hardEdges: 0,
        softEdges: 0,
        edgeDensity: 0,
        isolatedNodes: 0,
        cyclesFound: false,
        mutualReferencesCount: 0,
        mutualReferences: [],
        brokenLinks: 0,
        missingDependencies: [],
        timing: { cloneMs: 0, analysisMs: 0, totalMs: 0 },
      });
      evidenceRepos.push({
        repo: repo.name,
        commitSha: 'failed',
        cycles: [],
        mutualReferences: [],
        brokenLinks: [],
      });
    }
  }

  const totalFilesFound = results.reduce((acc, r) => acc + r.filesFound, 0);
  const totalFilesParsedOK = results.reduce((acc, r) => acc + r.filesParsedOK, 0);
  const totalNodes = results.reduce((acc, r) => acc + r.nodes, 0);
  const totalEdges = results.reduce((acc, r) => acc + r.edges, 0);
  const totalDuplicateIds = results.reduce((acc, r) => acc + r.duplicateIdsCount, 0);
  const totalUniqueIds = results.reduce((acc, r) => acc + r.uniqueIdsCount, 0);
  const totalHardEdges = results.reduce((acc, r) => acc + r.hardEdges, 0);
  const totalSoftEdges = results.reduce((acc, r) => acc + r.softEdges, 0);
  const totalResolvedLinks = results.reduce((acc, r) => acc + (r.resolvedLinks ?? 0), 0);
  const totalNonDecisionLinks = results.reduce((acc, r) => acc + (r.nonDecisionLinks ?? 0), 0);
  const totalOutsideScopeLinks = results.reduce((acc, r) => acc + (r.outsideScopeLinks ?? 0), 0);
  const totalAmbiguousLinks = results.reduce((acc, r) => acc + (r.ambiguousLinks ?? 0), 0);
  const totalExternalLinks = results.reduce((acc, r) => acc + (r.externalLinks ?? 0), 0);
  const totalBrokenLinks = results.reduce((acc, r) => acc + r.brokenLinks, 0);
  const totalCyclesDetected = results.filter((r) => r.cyclesFound).length;
  const totalMutualReferences = results.reduce((acc, r) => acc + r.mutualReferencesCount, 0);
  const averageParseRatePercent = totalFilesFound > 0
    ? Number(((totalFilesParsedOK / totalFilesFound) * 100).toFixed(1))
    : 0;

  const timestamp = new Date().toISOString();
  const runnerVersion = '1.0.0-phase2c.1.1';

  const report: CorpusBenchmarkReport = {
    timestamp,
    runnerVersion,
    licenseNotice: registry.licenseNotice,
    summary: {
      totalReposAnalyzed: results.length,
      totalFilesFound,
      totalFilesParsedOK,
      averageParseRatePercent,
      totalNodes,
      totalEdges,
      totalDuplicateIds,
      totalUniqueIds,
      totalHardEdges,
      totalSoftEdges,
      totalResolvedLinks,
      totalNonDecisionLinks,
      totalOutsideScopeLinks,
      totalAmbiguousLinks,
      totalExternalLinks,
      totalBrokenLinks,
      totalCyclesDetected,
      totalMutualReferences,
    },
    results,
    droppedRepositories: registry.evaluatedAndDropped,
  };

  const evidenceReport: CorpusEvidenceReport = {
    timestamp,
    runnerVersion,
    repositories: evidenceRepos,
  };

  const resultsJsonPath = await writeCorpusResultsJson(report);
  console.log(chalk.green(`\n✔ Wrote raw benchmark JSON: ${resultsJsonPath}`));

  const evidenceJsonPath = await writeEvidenceJson(evidenceReport);
  console.log(chalk.green(`✔ Wrote manual review evidence JSON: ${evidenceJsonPath}`));

  const findingsDocPath = await writeFindingsMarkdown(report);
  console.log(chalk.green(`✔ Wrote summary report: ${findingsDocPath}`));

  return report;
}

// Direct CLI invocation
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  runCorpusBenchmark()
    .then((report) => {
      console.log(chalk.bold.green(`\nCorpus run finished successfully! Analyzed ${report.results.length} repos.`));
      process.exit(0);
    })
    .catch((err) => {
      console.error(chalk.red('\nCorpus run failed:'), err);
      process.exit(1);
    });
}
