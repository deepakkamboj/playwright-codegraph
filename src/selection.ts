import { minimatch } from 'minimatch';

import type { CodegraphSelectionConfig } from './config.js';
import type { RushWorkspace } from './rush.js';
import type {
  ChangedFile,
  FullRunReason,
  SelectedTest,
  SelectionPlan,
  SelectionReason,
  TestBucket,
  TestKind,
} from './types.js';
import type { ScenarioInventory } from './scenarios.js';
import { scenarioTestsForChanges } from './scenarios.js';
import { fingerprint, sortedUnique } from './utils.js';

export interface SelectionInput {
  readonly root: string;
  readonly baseRef: string;
  readonly mergeBase: string;
  readonly config: CodegraphSelectionConfig;
  readonly workspace: RushWorkspace;
  readonly changedFiles: readonly ChangedFile[];
  readonly repositoryFiles: readonly string[];
  readonly codegraphVersion: string;
  readonly codegraphAffectedTests: readonly string[];
  readonly scenarios: ScenarioInventory;
  readonly scenarioCoverageGaps?: readonly string[];
}

export function selectTests(input: SelectionInput): SelectionPlan {
  const relevantChanges = input.changedFiles.filter(
    (change) => !input.config.ignoredChanges.some((pattern) => minimatch(change.path, pattern, { dot: true })),
  );
  const unitFiles = matching(input.repositoryFiles, input.config.unitTestGlobs);
  const playwrightFiles = matching(input.repositoryFiles, input.config.playwrightTestGlobs);
  const allTests = new Set([...unitFiles, ...playwrightFiles]);
  const selected = new Map<string, { kind: TestKind; bucket: TestBucket; project?: string; reasons: SelectionReason[] }>();
  const fullRunReasons: FullRunReason[] = [];
  if ((input.scenarioCoverageGaps ?? []).length > 0) {
    fullRunReasons.push({
      code: 'unsafe-input',
      detail: `scenario coverage has ${(input.scenarioCoverageGaps ?? []).length} gap(s): ${(input.scenarioCoverageGaps ?? [])[0]}`,
    });
  }

  const add = (file: string, reason: SelectionReason, bucket: TestBucket = 'full') => {
    if (!allTests.has(file)) return;
    const kind: TestKind = playwrightFiles.includes(file) ? 'playwright' : 'unit';
    const project = input.workspace.projectForFile(file)?.name;
    const current = selected.get(file) ?? { kind, bucket, ...(project ? { project } : {}), reasons: [] };
    if (!current.reasons.some((existing) => JSON.stringify(existing) === JSON.stringify(reason))) current.reasons.push(reason);
    selected.set(file, current);
  };

  for (const change of relevantChanges) {
    if (allTests.has(change.path) && change.status !== 'deleted') {
      add(change.path, { code: 'changed-test', detail: 'test file changed', changedFile: change.path });
    }
    if (input.config.globalTriggers.some((pattern) => minimatch(change.path, pattern, { dot: true }))) {
      fullRunReasons.push({ code: 'global-trigger', detail: change.path });
    }
    const owner = input.workspace.projectForFile(change.path);
    if (!owner) {
      fullRunReasons.push({ code: 'unknown-file', detail: change.path });
      continue;
    }
    const isSource = input.config.sourceExtensions.some((extension) => change.path.endsWith(extension));
    const projectWide = input.config.projectWideTriggers.some((pattern) => minimatch(change.path, pattern, { dot: true }));
    if (change.status === 'deleted' || !isSource || projectWide) {
      for (const test of unitFiles.filter((file) => input.workspace.projectForFile(file)?.name === owner.name)) {
        add(test, { code: 'project-expansion', detail: `ungraphable change in ${owner.name}`, changedFile: change.path });
      }
    }
  }
  for (const test of input.codegraphAffectedTests) {
    add(test, { code: 'codegraph-reachable', detail: 'required codegraph reported affected' });
  }
  const changedProjectNames = new Set(
    relevantChanges
      .map((change) => input.workspace.projectForFile(change.path)?.name)
      .filter((name): name is string => Boolean(name)),
  );
  for (const test of playwrightFiles) {
    const owner = input.workspace.projectForFile(test)?.name;
    if (owner && changedProjectNames.has(owner)) {
      add(test, { code: 'project-owned', detail: `Playwright test is owned by changed project ${owner}` });
    }
  }
  const projectsByName = new Map(input.workspace.projects.map((project) => [project.name, project]));
  const distances = dependentDistances(changedProjectNames, projectsByName);
  for (const [projectName, distance] of distances) {
    if (changedProjectNames.has(projectName)) continue;
    const ownedTests = [...allTests].filter((test) => input.workspace.projectForFile(test)?.name === projectName);
    if (distance <= input.config.projectDependentDepth) {
      for (const test of ownedTests.filter((file) => unitFiles.includes(file))) {
        add(test, { code: 'dependent-project', detail: `${projectName} is a Rush dependent at distance ${distance}` });
      }
    } else {
      for (const test of matching(ownedTests, input.config.smokeTestGlobs)) {
        add(test, { code: 'smoke-safety', detail: `${projectName} is a distant Rush dependent` }, 'smoke');
      }
    }
  }
  for (const rule of input.config.mappings) {
    const changedFile = relevantChanges.find((change) =>
      rule.when.some((pattern) => minimatch(change.path, pattern, { dot: true })),
    )?.path;
    if (!changedFile) continue;
    for (const test of matching([...allTests], rule.tests)) {
      add(test, { code: 'mapping', detail: 'explicit mapping rule matched', changedFile });
    }
  }
  for (const [scenarioId, tests] of scenarioTestsForChanges(
    input.scenarios,
    relevantChanges.map((change) => change.path),
  )) {
    if (tests.length === 0) {
      fullRunReasons.push({ code: 'unsafe-input', detail: `changed scenario ${scenarioId} has no linked tests` });
    }
    for (const test of tests) add(test, { code: 'covers', detail: `scenario ${scenarioId} covers changed code` });
  }
  for (const test of matching([...allTests], input.config.coreTestGlobs)) {
    add(test, { code: 'core-safety', detail: 'configured core safety test' }, 'core');
  }

  const selectedUnit = [...selected].filter(([, value]) => value.kind === 'unit').length;
  const selectedPlaywright = [...selected].filter(([, value]) => value.kind === 'playwright').length;
  if (selectedUnit > input.config.maxSelectedUnitFiles || selectedPlaywright > input.config.maxSelectedPlaywrightFiles) {
    fullRunReasons.push({
      code: 'selection-limit',
      detail: `selection exceeded limits: unit=${selectedUnit}, playwright=${selectedPlaywright}`,
    });
  }
  if (
    exceedsArgumentLimit(input.config.unit, [...selected].filter(([, value]) => value.kind === 'unit').map(([file]) => file)) ||
    exceedsArgumentLimit(
      input.config.playwright,
      [...selected].filter(([, value]) => value.kind === 'playwright').map(([file]) => file),
    )
  ) {
    fullRunReasons.push({ code: 'selection-limit', detail: 'selected file arguments exceed the configured command limit' });
  }
  const full = fullRunReasons.length > 0;
  if (full) {
    for (const test of allTests) add(test, { code: 'full-fallback', detail: 'deterministic safety fallback' });
  }
  const tests: SelectedTest[] = [...selected]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, value]) => ({
      path: file,
      kind: value.kind,
      bucket: value.bucket,
      ...(value.project ? { project: value.project } : {}),
      reasons: [...value.reasons].sort((left, right) =>
        `${left.code}:${left.detail}:${left.changedFile ?? ''}`.localeCompare(
          `${right.code}:${right.detail}:${right.changedFile ?? ''}`,
        ),
      ),
    }));
  const changedProjects = sortedUnique(
    relevantChanges.map((change) => input.workspace.projectForFile(change.path)?.name).filter((name): name is string => Boolean(name)),
  );
  const inputFingerprint = fingerprint([
    input.baseRef,
    input.mergeBase,
    input.codegraphVersion,
    JSON.stringify(input.config),
    JSON.stringify(input.changedFiles),
    JSON.stringify(input.workspace.projects),
    JSON.stringify(input.repositoryFiles),
    JSON.stringify([...input.scenarios.testsByScenario]),
  ]);
  return {
    schemaVersion: 1,
    inputFingerprint,
    repositoryRoot: input.root,
    baseRef: input.baseRef,
    mergeBase: input.mergeBase,
    mode: full ? 'full' : tests.length ? 'selective' : 'empty',
    fullRunReasons: fullRunReasons.sort((left, right) => `${left.code}:${left.detail}`.localeCompare(`${right.code}:${right.detail}`)),
    changedFiles: [...relevantChanges].sort((left, right) => left.path.localeCompare(right.path)),
    changedProjects,
    tests,
    warnings: [],
  };
}

function matching(files: readonly string[], patterns: readonly string[]): string[] {
  return sortedUnique(files.filter((file) => patterns.some((pattern) => minimatch(file, pattern, { dot: true }))));
}

function exceedsArgumentLimit(
  command: CodegraphSelectionConfig['unit'],
  files: readonly string[],
): boolean {
  const args = command.args.flatMap((arg) => (arg === '{files}' ? files : [arg]));
  return command.executable.length + args.reduce((total, arg) => total + arg.length + 1, 0) > command.maxArgumentCharacters;
}

function dependentDistances(
  changedProjects: ReadonlySet<string>,
  projects: ReadonlyMap<string, { readonly dependents: readonly string[] }>,
): ReadonlyMap<string, number> {
  const distances = new Map([...changedProjects].map((name) => [name, 0]));
  let frontier = [...changedProjects];
  while (frontier.length) {
    const next: string[] = [];
    for (const projectName of frontier) {
      const distance = distances.get(projectName) ?? 0;
      for (const dependent of projects.get(projectName)?.dependents ?? []) {
        if (!distances.has(dependent)) {
          distances.set(dependent, distance + 1);
          next.push(dependent);
        }
      }
    }
    frontier = next;
  }
  return distances;
}
