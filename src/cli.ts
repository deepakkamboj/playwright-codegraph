#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { minimatch } from 'minimatch';

import { CliCodegraphAdapter } from './codegraph.js';
import { loadConfig } from './config.js';
import { executePlan } from './executor.js';
import { listRepositoryFiles } from './git.js';
import { generateHtmlReport } from './html-report.js';
import { createPlan } from './planner.js';
import { scenarioCoverageMarkdown } from './reports.js';
import { replayShadowRecords } from './replay.js';
import {
  buildScenarioCoverage,
  loadScenarioInventory,
  parseLcovRuntimeFiles,
  parseV8RuntimeFiles,
  scenarioTestsForChanges,
} from './scenarios.js';
import { executeShadow } from './shadow.js';
import { canonicalJson } from './utils.js';
import type { SelectionPlan } from './types.js';

const [command = 'help', ...rawArgs] = process.argv.slice(2);
const args = parseArgs(rawArgs);
const root = path.resolve(value(args, 'root') ?? process.cwd());
const configPath = value(args, 'config');

try {
  if (command === 'plan') {
    const baseRef = value(args, 'base');
    const plan = await createPlan({
      root,
      ...(configPath ? { configPath } : {}),
      ...(baseRef ? { baseRef } : {}),
      forceFull: Boolean(args.full),
    });
    write(value(args, 'out') ?? path.join(root, 'test-selection-out', 'plan.json'), canonicalJson(plan));
    console.error(`${plan.mode.toUpperCase()}: ${plan.tests.length} tests; ${plan.fullRunReasons.length} fallback reasons`);
  } else if (command === 'run') {
    const config = loadConfig(root, configPath);
    const planFile = path.resolve(root, value(args, 'plan') ?? 'test-selection-out/plan.json');
    const parsed: unknown = JSON.parse(fs.readFileSync(planFile, 'utf8'));
    if (!isSelectionPlan(parsed)) throw new Error(`Invalid selection plan: ${planFile}`);
    const plan = parsed;
    const execution = await executePlan(plan, config);
    write(value(args, 'out') ?? path.join(root, 'test-selection-out', 'execution.json'), canonicalJson(execution));
    process.exitCode = execution.exitCode;
  } else if (command === 'doctor') {
    const config = loadConfig(root, configPath);
    const adapter = new CliCodegraphAdapter(root, config.codegraph);
    console.log(`codegraph ${await adapter.getVersion()}`);
    await adapter.status();
    console.log('codegraph index: ready');
  } else if (command === 'report') {
    const artifactDirectory = path.resolve(root, value(args, 'artifacts') ?? 'test-selection-out');
    const outputFile = path.resolve(root, value(args, 'out') ?? 'test-selection-out/codegraph-report.html');
    const title = value(args, 'title');
    generateHtmlReport({
      artifactDirectory,
      outputFile,
      ...(title ? { title } : {}),
    });
    console.log(`HTML report: ${outputFile}`);
  } else if (command === 'shadow') {
    const config = loadConfig(root, configPath);
    const baseRef = value(args, 'base');
    const plan = await createPlan({
      root,
      ...(configPath ? { configPath } : {}),
      ...(baseRef ? { baseRef } : {}),
    });
    const result = await executeShadow(plan, config);
    write(value(args, 'out') ?? path.join(root, 'test-selection-out', 'shadow.json'), canonicalJson(result));
    process.exitCode = result.full.exitCode;
  } else if (command === 'replay') {
    const directory = path.resolve(root, value(args, 'records') ?? 'test-selection-history');
    const summary = replayShadowRecords(directory);
    write(value(args, 'out') ?? path.join(root, 'test-selection-out', 'replay.json'), canonicalJson(summary));
    if (summary.missedFailures > 0) process.exitCode = 2;
  } else if (command === 'explain') {
    const file = rawArgs.find((arg) => !arg.startsWith('--'));
    if (!file) throw new Error('explain requires a repository-relative file');
    const config = loadConfig(root, configPath);
    const files = await listRepositoryFiles(root);
    const testFiles = files.filter((candidate) =>
      [...config.unitTestGlobs, ...config.playwrightTestGlobs].some((pattern) =>
        minimatch(candidate, pattern, { dot: true }),
      ),
    );
    const inventory = loadScenarioInventory(root, config.scenarios.registry, testFiles);
    const adapter = new CliCodegraphAdapter(root, config.codegraph);
    const version = await adapter.getVersion();
    await adapter.sync();
    await adapter.status();
    const affectedTests = await adapter.affected({ files: [file], depth: config.codegraph.depth });
    const scenarioMatches = Object.fromEntries(scenarioTestsForChanges(inventory, [file]));
    console.log(canonicalJson({ file, codegraphVersion: version, affectedTests, scenarioMatches }));
  } else if (command === 'graph') {
    const config = loadConfig(root, configPath);
    const action = rawArgs.find((arg) => !arg.startsWith('--')) ?? 'status';
    const adapter = new CliCodegraphAdapter(root, config.codegraph);
    await adapter.getVersion();
    if (action === 'build') await adapter.build(Boolean(args.force));
    else if (action === 'sync') await adapter.sync();
    else if (action === 'status') await adapter.status();
    else throw new Error(`Unknown graph action: ${action}`);
  } else if (command === 'scenarios') {
    const config = loadConfig(root, configPath);
    const files = await listRepositoryFiles(root);
    const testFiles = files.filter((file) =>
      [...config.unitTestGlobs, ...config.playwrightTestGlobs].some((pattern) => minimatch(file, pattern, { dot: true })),
    );
    const inventory = loadScenarioInventory(root, config.scenarios.registry, testFiles);
    const lcov = value(args, 'lcov');
    const v8 = value(args, 'v8');
    const runtime = lcov
      ? parseLcovRuntimeFiles(root, path.resolve(root, lcov))
      : v8
        ? parseV8RuntimeFiles(root, path.resolve(root, v8))
        : new Set<string>();
    const adapter = new CliCodegraphAdapter(root, config.codegraph);
    await adapter.getVersion();
    await adapter.sync();
    await adapter.status();
    const report = await buildScenarioCoverage(inventory, files, adapter, config.codegraph.depth, runtime);
    const out = value(args, 'out') ?? path.join(root, 'test-selection-out', 'scenario-coverage.json');
    write(out, canonicalJson(report));
    write(out.replace(/\.json$/i, '.md'), scenarioCoverageMarkdown(report));
    if (report.gaps.length || (config.scenarios.requireRuntimeEvidence && report.entries.some((entry) => !entry.observedRuntimeFiles.length))) {
      process.exitCode = 2;
    }
  } else {
    console.log(`playwright-codegraph

Commands:
  plan [--root path] [--base ref] [--config file] [--out file] [--full]
  run [--root path] [--config file] [--plan file] [--out file]
  doctor [--root path] [--config file]
  report [--root path] [--artifacts directory] [--out file] [--title text]
  shadow [--root path] [--base ref] [--out file]
  replay [--root path] [--records directory] [--out file]
  explain <file> [--root path] [--config file]
  graph build|sync|status [--root path] [--force]
  scenarios [--root path] [--config file] [--lcov file | --v8 file] [--out file]`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseArgs(values: readonly string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < values.length; index++) {
    const current = values[index]!;
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = values[index + 1];
    if (next && !next.startsWith('--')) {
      parsed[key] = next;
      index++;
    } else parsed[key] = true;
  }
  return parsed;
}

function value(args: Record<string, string | boolean>, key: string): string | undefined {
  const result = args[key];
  return typeof result === 'string' ? result : undefined;
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function isSelectionPlan(value: unknown): value is SelectionPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const plan = value as Record<string, unknown>;
  return (
    plan.schemaVersion === 1 &&
    typeof plan.inputFingerprint === 'string' &&
    typeof plan.repositoryRoot === 'string' &&
    typeof plan.baseRef === 'string' &&
    ['empty', 'selective', 'full'].includes(String(plan.mode)) &&
    Array.isArray(plan.fullRunReasons) &&
    Array.isArray(plan.changedFiles) &&
    Array.isArray(plan.changedProjects) &&
    Array.isArray(plan.tests) &&
    Array.isArray(plan.warnings)
  );
}
