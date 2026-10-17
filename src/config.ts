import fs from 'node:fs';
import path from 'node:path';

export interface CommandConfig {
  readonly executable: string;
  readonly args: readonly string[];
  readonly fullArgs: readonly string[];
  readonly cwd?: string;
  readonly maxArgumentCharacters: number;
}

export interface ScenarioConfig {
  readonly registry: string;
  readonly requireRuntimeEvidence: boolean;
}

export interface CodegraphConfig {
  readonly executable: string;
  readonly minimumVersion: string;
  readonly depth: number;
  readonly timeoutMs: number;
  readonly testFilter?: string;
}

export interface MappingRule {
  readonly when: readonly string[];
  readonly tests: readonly string[];
}

export interface CodegraphSelectionConfig {
  readonly baseRef: string;
  readonly includeUntracked: boolean;
  readonly sourceExtensions: readonly string[];
  readonly ignoredChanges: readonly string[];
  readonly globalTriggers: readonly string[];
  readonly projectWideTriggers: readonly string[];
  readonly unitTestGlobs: readonly string[];
  readonly playwrightTestGlobs: readonly string[];
  readonly coreTestGlobs: readonly string[];
  readonly smokeTestGlobs: readonly string[];
  readonly mappings: readonly MappingRule[];
  readonly maxSelectedUnitFiles: number;
  readonly maxSelectedPlaywrightFiles: number;
  readonly projectDependentDepth: number;
  readonly codegraph: CodegraphConfig;
  readonly scenarios: ScenarioConfig;
  readonly unit: CommandConfig;
  readonly playwright: CommandConfig;
}

export const DEFAULT_CONFIG: CodegraphSelectionConfig = {
  baseRef: 'origin/main',
  includeUntracked: true,
  sourceExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  ignoredChanges: ['**/*.md', 'docs/**', '**/*.png', '**/*.jpg', '**/*.gif', '**/CODEOWNERS', '**/.vscode/**'],
  globalTriggers: [
    'rush.json',
    'common/config/**',
    'common/autoinstallers/**',
    'tsconfig*.json',
    'playwright.config.*',
    'playwright-codegraph.config.json',
  ],
  projectWideTriggers: ['**/package.json', '**/jest.config.*', '**/vitest.config.*', '**/*.config.{js,ts,mjs,cjs}'],
  unitTestGlobs: ['**/src/**/*.test.{ts,tsx,js,jsx}', '**/src/**/__tests__/**/*.{ts,tsx,js,jsx}'],
  playwrightTestGlobs: ['**/e2e/**/*.spec.{ts,tsx,js,jsx}', '**/tests/**/*.spec.{ts,tsx,js,jsx}'],
  coreTestGlobs: [],
  smokeTestGlobs: [],
  mappings: [],
  maxSelectedUnitFiles: 3000,
  maxSelectedPlaywrightFiles: 400,
  projectDependentDepth: 1,
  codegraph: {
    executable: 'codegraph',
    minimumVersion: '1.6.2',
    depth: 12,
    timeoutMs: 1_200_000,
  },
  scenarios: {
    registry: 'test-scenarios.yml',
    requireRuntimeEvidence: false,
  },
  unit: {
    executable: 'npx',
    args: ['jest', '--passWithNoTests', '--runTestsByPath', '{files}'],
    fullArgs: ['rush', 'test'],
    maxArgumentCharacters: 20_000,
  },
  playwright: {
    executable: 'npx',
    args: ['playwright', 'test', '{files}'],
    fullArgs: ['playwright', 'test'],
    maxArgumentCharacters: 20_000,
  },
};

const TOP_LEVEL_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

export function loadConfig(root: string, configPath = 'playwright-codegraph.config.json'): CodegraphSelectionConfig {
  const absolute = path.resolve(root, configPath);
  if (!fs.existsSync(absolute)) return DEFAULT_CONFIG;
  const parsed: unknown = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Config must be a JSON object');
  const input = parsed as Record<string, unknown>;
  const unknown = Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.has(key));
  if (unknown.length) throw new Error(`Unknown config keys: ${unknown.sort().join(', ')}`);
  rejectUnknown(objectValue(input.codegraph, 'codegraph'), new Set(['executable', 'minimumVersion', 'depth', 'timeoutMs', 'testFilter']), 'codegraph');
  rejectUnknown(objectValue(input.scenarios, 'scenarios'), new Set(['registry', 'requireRuntimeEvidence']), 'scenarios');
  const commandKeys = new Set(['executable', 'args', 'fullArgs', 'cwd', 'maxArgumentCharacters']);
  rejectUnknown(objectValue(input.unit, 'unit'), commandKeys, 'unit');
  rejectUnknown(objectValue(input.playwright, 'playwright'), commandKeys, 'playwright');
  const merged = {
    ...DEFAULT_CONFIG,
    ...input,
    codegraph: { ...DEFAULT_CONFIG.codegraph, ...objectValue(input.codegraph, 'codegraph') },
    scenarios: { ...DEFAULT_CONFIG.scenarios, ...objectValue(input.scenarios, 'scenarios') },
    unit: { ...DEFAULT_CONFIG.unit, ...objectValue(input.unit, 'unit') },
    playwright: { ...DEFAULT_CONFIG.playwright, ...objectValue(input.playwright, 'playwright') },
  } as CodegraphSelectionConfig;
  validateConfig(merged);
  return merged;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function validateConfig(config: CodegraphSelectionConfig): void {
  if (config.baseRef.startsWith('-')) throw new Error('baseRef must not begin with "-"');
  if (!Number.isInteger(config.codegraph.depth) || config.codegraph.depth < 1) throw new Error('codegraph.depth must be positive');
  if (!Number.isInteger(config.codegraph.timeoutMs) || config.codegraph.timeoutMs < 1) throw new Error('codegraph.timeoutMs must be positive');
  if (!Number.isInteger(config.projectDependentDepth) || config.projectDependentDepth < 0) {
    throw new Error('projectDependentDepth must be a non-negative integer');
  }

  for (const [label, command] of [['unit', config.unit], ['playwright', config.playwright]] as const) {
    if (!command.executable || command.executable.includes('\0')) throw new Error(`${label}.executable is invalid`);
    if (!command.args.includes('{files}')) throw new Error(`${label}.args must contain {files}`);
  }
}

function rejectUnknown(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): void {
  const keys = Object.keys(value).filter((key) => !allowed.has(key));
  if (keys.length) throw new Error(`Unknown ${label} config keys: ${keys.sort().join(', ')}`);
}
