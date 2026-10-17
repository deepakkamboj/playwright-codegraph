import { minimatch } from 'minimatch';

import { CliCodegraphAdapter, CodegraphError } from './codegraph.js';
import { loadConfig, type CodegraphSelectionConfig } from './config.js';
import { detectChanges, listRepositoryFiles } from './git.js';
import { loadRushWorkspace } from './rush.js';
import { buildScenarioCoverage, loadScenarioInventory } from './scenarios.js';
import { selectTests } from './selection.js';
import type { FullRunReason, SelectedTest, SelectionPlan } from './types.js';
import { fingerprint, sortedUnique } from './utils.js';

export interface PlanOptions {
  readonly root: string;
  readonly configPath?: string;
  readonly baseRef?: string;
}

export async function createPlan(options: PlanOptions): Promise<SelectionPlan> {
  let config: CodegraphSelectionConfig;
  try {
    config = loadConfig(options.root, options.configPath);
  } catch (error) {
    return await fallbackPlan(options.root, options.baseRef ?? 'origin/main', undefined, {
      code: 'invalid-config',
      detail: message(error),
    });
  }
  const baseRef = options.baseRef ?? config.baseRef;
  try {
    const [changes, files] = await Promise.all([
      detectChanges(options.root, baseRef, config.includeUntracked),
      listRepositoryFiles(options.root),
    ]);
    const workspace = loadRushWorkspace(options.root);
    const allTests = testFiles(files, config);
    const scenarios = loadScenarioInventory(options.root, config.scenarios.registry, allTests);
    const codegraph = new CliCodegraphAdapter(options.root, config.codegraph);
    const version = await codegraph.getVersion();
    await codegraph.status();
    await codegraph.sync();
    await codegraph.status();
    const scenarioCoverage = await buildScenarioCoverage(
      scenarios,
      files,
      codegraph,
      config.codegraph.depth,
    );
    const sourceChanges = changes.files
      .filter(
        (change) =>
          change.status !== 'deleted' &&
          config.sourceExtensions.some((extension) => change.path.endsWith(extension)),
      )
      .map((change) => change.path);
    const affected = await codegraph.affected({
      files: sourceChanges,
      depth: config.codegraph.depth,
      ...(config.codegraph.testFilter ? { testFilter: config.codegraph.testFilter } : {}),
    });
    return selectTests({
      root: options.root,
      baseRef,
      mergeBase: changes.mergeBase,
      config,
      workspace,
      changedFiles: changes.files,
      repositoryFiles: files,
      codegraphVersion: version,
      codegraphAffectedTests: affected,
      scenarios,
      scenarioCoverageGaps: scenarioCoverage.gaps,
    });
  } catch (error) {
    return await fallbackPlan(options.root, baseRef, config, reasonFor(error));
  }
}

async function fallbackPlan(
  root: string,
  baseRef: string,
  config: CodegraphSelectionConfig | undefined,
  reason: FullRunReason,
): Promise<SelectionPlan> {
  let files: readonly string[] = [];
  try {
    files = await listRepositoryFiles(root);
  } catch {
    // An empty inventory is still an explicit full plan; the runner uses full commands.
  }
  const tests: SelectedTest[] = config
    ? testFiles(files, config).map((file) => ({
        path: file,
        kind: config.playwrightTestGlobs.some((pattern) => minimatch(file, pattern, { dot: true }))
          ? 'playwright'
          : 'unit',
        bucket: 'full',
        reasons: [{ code: 'full-fallback', detail: reason.detail }],
      }))
    : [];
  return {
    schemaVersion: 1,
    inputFingerprint: fingerprint([baseRef, JSON.stringify(config), JSON.stringify(files), JSON.stringify(reason)]),
    repositoryRoot: root,
    baseRef,
    mergeBase: null,
    mode: 'full',
    fullRunReasons: [reason],
    changedFiles: [],
    changedProjects: [],
    tests,
    warnings: [],
  };
}

function testFiles(files: readonly string[], config: CodegraphSelectionConfig): string[] {
  return sortedUnique(
    files.filter((file) =>
      [...config.unitTestGlobs, ...config.playwrightTestGlobs].some((pattern) => minimatch(file, pattern, { dot: true })),
    ),
  );
}

function reasonFor(error: unknown): FullRunReason {
  if (error instanceof CodegraphError) {
    const code = {
      unavailable: 'codegraph-unavailable',
      incompatible: 'codegraph-incompatible',
      failed: 'codegraph-failed',
      timeout: 'codegraph-timeout',
    } as const;
    return { code: code[error.kind], detail: error.message };
  }
  const detail = message(error);
  if (/merge-base|git/i.test(detail)) return { code: 'git-history-incomplete', detail };
  if (/config|scenario|rush\.json|package/i.test(detail)) return { code: 'invalid-config', detail };
  return { code: 'unsafe-input', detail };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
