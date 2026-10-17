import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { minimatch } from 'minimatch';
import { parse } from 'yaml';

import type {
  CustomerJourney,
  ScenarioCoverageEntry,
  ScenarioCoverageReport,
  ScenarioDefinition,
  ScenarioRegistry,
  UserJourney,
} from './types.js';
import type { CodegraphAdapter } from './types.js';
import { fingerprint, sortedUnique, toPosix } from './utils.js';

export interface ScenarioInventory {
  readonly registry: ScenarioRegistry;
  readonly scenarios: ReadonlyMap<string, ScenarioDefinition>;
  readonly testsByScenario: ReadonlyMap<string, readonly string[]>;
}

export function loadScenarioInventory(
  root: string,
  registryPath: string,
  testFiles: readonly string[],
): ScenarioInventory {
  const absolute = path.resolve(root, registryPath);
  if (!fs.existsSync(absolute)) throw new Error(`Scenario registry not found: ${registryPath}`);
  const registry = parseRegistry(parse(fs.readFileSync(absolute, 'utf8')) as unknown);
  const scenarios = new Map<string, ScenarioDefinition>();
  const customerIds = new Set<string>();
  const userJourneyIds = new Set<string>();
  for (const customer of registry.customerJourneys) {
    if (customerIds.has(customer.id)) throw new Error(`Duplicate customer journey id: ${customer.id}`);
    customerIds.add(customer.id);
    for (const journey of customer.userJourneys) {
      if (userJourneyIds.has(journey.id)) throw new Error(`Duplicate user journey id: ${journey.id}`);
      userJourneyIds.add(journey.id);
      for (const scenario of journey.scenarios) {
        if (scenarios.has(scenario.id)) throw new Error(`Duplicate scenario id: ${scenario.id}`);
        scenarios.set(scenario.id, scenario);
      }
    }
  }
  const mutable = new Map<string, Set<string>>();
  for (const testFile of testFiles) {
    const source = fs.readFileSync(path.join(root, testFile), 'utf8');
    for (const scenarioId of annotations(source)) {
      if (!scenarios.has(scenarioId)) throw new Error(`Unknown scenario annotation ${scenarioId} in ${testFile}`);
      const files = mutable.get(scenarioId) ?? new Set<string>();
      files.add(testFile);
      mutable.set(scenarioId, files);
    }
  }
  return {
    registry,
    scenarios,
    testsByScenario: new Map([...mutable].map(([id, files]) => [id, sortedUnique(files)])),
  };
}

export async function buildScenarioCoverage(
  inventory: ScenarioInventory,
  repositoryFiles: readonly string[],
  codegraph: CodegraphAdapter,
  depth: number,
  runtimeFiles: ReadonlySet<string> = new Set(),
): Promise<ScenarioCoverageReport> {
  const entries: ScenarioCoverageEntry[] = [];
  const globalGaps: string[] = [];
  for (const scenario of [...inventory.scenarios.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    const testFiles = inventory.testsByScenario.get(scenario.id) ?? [];
    const resolvedCodePaths = new Set<string>();
    const staticallyLinked = new Set<string>();
    const gaps: string[] = [];
    if (testFiles.length === 0) gaps.push('scenario has no linked tests');
    for (const pattern of scenario.codePaths) {
      const matches = repositoryFiles.filter((file) => minimatch(file, pattern, { dot: true }));
      if (matches.length === 0) {
        gaps.push(`code path resolves no files: ${pattern}`);
        continue;
      }
      matches.forEach((file) => resolvedCodePaths.add(file));
      for (const file of matches) {
        const affected = new Set(await codegraph.affected({ files: [file], depth }));
        if (testFiles.some((testFile) => affected.has(testFile))) staticallyLinked.add(file);
        else gaps.push(`code file has no statically linked scenario test: ${file}`);
      }
    }
    const observedRuntimeFiles = [...resolvedCodePaths].filter((file) => runtimeFiles.has(file)).sort();
    const entry = {
      scenarioId: scenario.id,
      testFiles,
      resolvedCodePaths: sortedUnique(resolvedCodePaths),
      staticallyLinkedCodePaths: sortedUnique(staticallyLinked),
      observedRuntimeFiles,
      gaps: gaps.sort(),
    };
    entries.push(entry);
    globalGaps.push(...gaps.map((gap) => `${scenario.id}: ${gap}`));
  }
  return {
    schemaVersion: 1,
    inputFingerprint: fingerprint(entries.map((entry) => JSON.stringify(entry))),
    entries,
    gaps: globalGaps.sort(),
  };
}

export function scenarioTestsForChanges(
  inventory: ScenarioInventory,
  changedFiles: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const matches = new Map<string, readonly string[]>();
  for (const scenario of inventory.scenarios.values()) {
    if (changedFiles.some((file) => scenario.codePaths.some((pattern) => minimatch(file, pattern, { dot: true })))) {
      matches.set(scenario.id, inventory.testsByScenario.get(scenario.id) ?? []);
    }
  }
  return matches;
}

export function parseLcovRuntimeFiles(root: string, lcovFile: string): ReadonlySet<string> {
  const observed = new Set<string>();
  let current: string | undefined;
  let hit = false;
  for (const line of fs.readFileSync(lcovFile, 'utf8').split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const source = line.slice(3);
      const absolute = path.isAbsolute(source)
        ? source
        : fs.existsSync(path.resolve(root, source))
          ? path.resolve(root, source)
          : path.resolve(path.dirname(lcovFile), source);
      current = toPosix(path.relative(root, absolute));
      hit = false;
    } else if (line.startsWith('DA:') && Number(line.split(',')[1] ?? 0) > 0) {
      hit = true;
    } else if (line === 'end_of_record' && current && hit) {
      observed.add(current);
    }

  }
  return observed;
}

export function parseV8RuntimeFiles(root: string, coverageFile: string): ReadonlySet<string> {
  const parsed: unknown = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
  const records = Array.isArray(parsed)
    ? (parsed as unknown[])
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).result)
      ? ((parsed as Record<string, unknown>).result as unknown[])
      : [];
  const observed = new Set<string>();
  for (const value of records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    if (typeof record.url !== 'string' || !Array.isArray(record.functions)) continue;
    const hit = (record.functions as unknown[]).some((functionValue) => {
      if (!functionValue || typeof functionValue !== 'object' || Array.isArray(functionValue)) return false;
      const ranges = (functionValue as Record<string, unknown>).ranges;
      return Array.isArray(ranges) && (ranges as unknown[]).some((rangeValue) => {
        if (!rangeValue || typeof rangeValue !== 'object' || Array.isArray(rangeValue)) return false;
        return Number((rangeValue as Record<string, unknown>).count ?? 0) > 0;
      });
    });
    if (!hit) continue;
    const url = record.url.startsWith('file:') ? new URL(record.url) : record.url;
    const absolute = url instanceof URL ? fileURLToPath(url) : path.resolve(root, url);
    const relative = toPosix(path.relative(root, absolute));
    if (relative !== '..' && !relative.startsWith('../')) observed.add(relative);
  }
  return observed;
}

function annotations(source: string): readonly string[] {
  const found = new Set<string>();
  const expression = /@scenario(?::|\s+)([a-zA-Z0-9][a-zA-Z0-9._/-]*)/g;
  for (const match of source.matchAll(expression)) if (match[1]) found.add(match[1]);
  return [...found].sort();
}

function parseRegistry(value: unknown): ScenarioRegistry {
  const object = record(value, 'scenario registry');
  if (object.schemaVersion !== 1) throw new Error('Scenario registry schemaVersion must be 1');
  const customerJourneys = array(object.customerJourneys, 'customerJourneys').map(parseCustomerJourney);
  return { schemaVersion: 1, customerJourneys };
}

function parseCustomerJourney(value: unknown): CustomerJourney {
  const object = record(value, 'customer journey');
  return {
    id: text(object.id, 'customer journey id'),
    title: text(object.title, 'customer journey title'),
    userJourneys: array(object.userJourneys, 'userJourneys').map(parseUserJourney),
  };
}

function parseUserJourney(value: unknown): UserJourney {
  const object = record(value, 'user journey');
  const actor = optionalText(object.actor, 'user journey actor');
  return {
    id: text(object.id, 'user journey id'),
    title: text(object.title, 'user journey title'),
    ...(actor ? { actor } : {}),
    scenarios: array(object.scenarios, 'scenarios').map(parseScenario),
  };
}

function parseScenario(value: unknown): ScenarioDefinition {
  const object = record(value, 'scenario');
  const criticality = object.criticality;
  if (!['critical', 'high', 'medium', 'low'].includes(String(criticality))) throw new Error('Invalid scenario criticality');
  const actor = optionalText(object.actor, 'scenario actor');
  return {
    id: text(object.id, 'scenario id'),
    title: text(object.title, 'scenario title'),
    ...(actor ? { actor } : {}),
    criticality: criticality as ScenarioDefinition['criticality'],
    requirementRefs: stringArray(object.requirementRefs, 'requirementRefs'),
    owners: stringArray(object.owners, 'owners'),
    tags: stringArray(object.tags, 'tags'),
    codePaths: stringArray(object.codePaths, 'codePaths'),
  };
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : text(value, label);
}

function stringArray(value: unknown, label: string): readonly string[] {
  return array(value ?? [], label).map((item) => text(item, label));
}
