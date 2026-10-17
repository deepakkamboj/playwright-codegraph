export const PLAN_SCHEMA_VERSION = 1 as const;

export type SelectionMode = 'empty' | 'selective' | 'full';
export type TestKind = 'unit' | 'playwright';
export type TestBucket = 'full' | 'smoke' | 'core';

export interface ChangedFile {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: 'added' | 'copied' | 'deleted' | 'modified' | 'renamed' | 'type-changed' | 'unmerged' | 'unknown';
  readonly source: 'merge-base' | 'staged' | 'unstaged' | 'untracked';
}

export interface RushProject {
  readonly name: string;
  readonly folder: string;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
}

export interface SelectionReason {
  readonly code:
    | 'changed-test'
    | 'codegraph-reachable'
    | 'covers'
    | 'mapping'
    | 'project-owned'
    | 'dependent-project'
    | 'core-safety'
    | 'smoke-safety'
    | 'project-expansion'
    | 'full-fallback';
  readonly detail: string;
  readonly changedFile?: string;
}

export interface SelectedTest {
  readonly path: string;
  readonly kind: TestKind;
  readonly bucket: TestBucket;
  readonly project?: string;
  readonly reasons: readonly SelectionReason[];
}

export interface FullRunReason {
  readonly code:
    | 'codegraph-unavailable'
    | 'codegraph-incompatible'
    | 'codegraph-failed'
    | 'codegraph-timeout'
    | 'git-history-incomplete'
    | 'global-trigger'
    | 'invalid-config'
    | 'unknown-file'
    | 'selection-limit'
    | 'manual-full-run'
    | 'unsafe-input';
  readonly detail: string;
}

export interface SelectionPlan {
  readonly schemaVersion: typeof PLAN_SCHEMA_VERSION;
  readonly inputFingerprint: string;
  readonly repositoryRoot: string;
  readonly baseRef: string;
  readonly mergeBase: string | null;
  readonly mode: SelectionMode;
  readonly fullRunReasons: readonly FullRunReason[];
  readonly changedFiles: readonly ChangedFile[];
  readonly changedProjects: readonly string[];
  readonly tests: readonly SelectedTest[];
  readonly warnings: readonly string[];
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly title: string;
  readonly actor?: string;
  readonly criticality: 'critical' | 'high' | 'medium' | 'low';
  readonly requirementRefs: readonly string[];
  readonly owners: readonly string[];
  readonly tags: readonly string[];
  readonly codePaths: readonly string[];
}

export interface UserJourney {
  readonly id: string;
  readonly title: string;
  readonly actor?: string;
  readonly scenarios: readonly ScenarioDefinition[];
}

export interface CustomerJourney {
  readonly id: string;
  readonly title: string;
  readonly userJourneys: readonly UserJourney[];
}

export interface ScenarioRegistry {
  readonly schemaVersion: 1;
  readonly customerJourneys: readonly CustomerJourney[];
}

export interface ScenarioCoverageEntry {
  readonly scenarioId: string;
  readonly testFiles: readonly string[];
  readonly resolvedCodePaths: readonly string[];
  readonly staticallyLinkedCodePaths: readonly string[];
  readonly observedRuntimeFiles: readonly string[];
  readonly gaps: readonly string[];
}

export interface ScenarioCoverageReport {
  readonly schemaVersion: 1;
  readonly inputFingerprint: string;
  readonly entries: readonly ScenarioCoverageEntry[];
  readonly gaps: readonly string[];
}

export interface CodegraphAffectedRequest {
  readonly files: readonly string[];
  readonly depth: number;
  readonly testFilter?: string;
}

export interface CodegraphAdapter {
  getVersion(): Promise<string>;
  status(): Promise<void>;
  build(force: boolean): Promise<void>;
  sync(): Promise<void>;
  affected(request: CodegraphAffectedRequest): Promise<readonly string[]>;
}
