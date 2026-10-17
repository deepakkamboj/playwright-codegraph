# Usage Guide

This guide shows how to configure, validate, and operate
`playwright-codegraph` in a Rush-based TypeScript repository. It covers local
development, scenario traceability, selective pull-request testing, full CI
testing, graph maintenance, safety fallbacks, and troubleshooting.

For a runnable reference, see
[`examples/rush-two-package`](./examples/rush-two-package).

## Contents

1. [How the workflow fits together](#how-the-workflow-fits-together)
2. [Install and configure](#install-and-configure)
3. [Create and maintain the graph](#create-and-maintain-the-graph)
4. [Inspect and use the graph](#inspect-and-use-the-graph)
5. [Create customer journeys and scenarios](#create-customer-journeys-and-scenarios)
6. [Validate scenario coverage](#validate-scenario-coverage)
7. [Select and run tests locally](#select-and-run-tests-locally)
8. [Run selective tests on a pull request](#run-selective-tests-on-a-pull-request)
9. [Run all tests in CI](#run-all-tests-in-ci)
10. [Exercise common change scenarios](#exercise-common-change-scenarios)
11. [Measure selection safety](#measure-selection-safety)
12. [Read the generated artifacts](#read-the-generated-artifacts)
13. [Troubleshoot graph and selection failures](#troubleshoot-graph-and-selection-failures)

## How the workflow fits together

The normal workflow has four deterministic stages:

```text
Git changes
    |
    v
Rush ownership + codegraph reachability + scenario mappings
    |
    v
Canonical plan.json
    |
    v
Unit and Playwright execution
```

The important commands are:

| Command | Purpose |
|---|---|
| `graph build` | Create the initial codegraph index or force a rebuild |
| `graph sync` | Incrementally synchronize the index |
| `doctor` | Verify the codegraph version and initialized index |
| `scenarios` | Validate journey, scenario, test, and code-path coverage |
| `plan` | Generate a deterministic affected-test plan |
| `run` | Execute an existing plan |
| `explain` | Explain what one changed file reaches |
| `shadow` | Run selective and authoritative full executions |
| `replay` | Aggregate retained shadow records |

The planner produces one of three modes:

- `empty`: no selected tests and no required safety tests.
- `selective`: run only tests listed in the plan.
- `full`: uncertainty was detected, so both configured full test commands run.

## Install and configure

Install both the selector and its required graph engine:

```bash
npm install --save-dev playwright-codegraph @colbymchenry/codegraph
```

Requirements:

- Node.js 20 or 22.
- A Git repository with enough history to calculate a merge base.
- A valid `rush.json`.
- Package manifests for every Rush project.
- `@colbymchenry/codegraph` 1.6.2 or a compatible newer 1.x version.

Copy and customize the examples:

```bash
cp node_modules/playwright-codegraph/playwright-codegraph.config.example.json playwright-codegraph.config.json
cp node_modules/playwright-codegraph/test-scenarios.example.yml test-scenarios.yml
```

On PowerShell:

```powershell
Copy-Item node_modules\playwright-codegraph\playwright-codegraph.config.example.json playwright-codegraph.config.json
Copy-Item node_modules\playwright-codegraph\test-scenarios.example.yml test-scenarios.yml
```

### Minimal selector configuration

```json
{
  "baseRef": "origin/main",
  "includeUntracked": true,
  "unitTestGlobs": [
    "**/src/**/*.test.{ts,tsx}"
  ],
  "playwrightTestGlobs": [
    "apps/e2e/tests/**/*.spec.ts"
  ],
  "coreTestGlobs": [
    "apps/e2e/tests/core/**/*.spec.ts"
  ],
  "smokeTestGlobs": [
    "apps/e2e/tests/**/*.smoke.spec.ts"
  ],
  "projectDependentDepth": 1,
  "codegraph": {
    "executable": "codegraph",
    "minimumVersion": "1.6.2",
    "depth": 12,
    "timeoutMs": 1200000
  },
  "scenarios": {
    "registry": "test-scenarios.yml",
    "requireRuntimeEvidence": false
  },
  "unit": {
    "executable": "npx",
    "args": ["vitest", "run", "{files}"],
    "fullArgs": ["vitest", "run"],
    "maxArgumentCharacters": 20000
  },
  "playwright": {
    "executable": "npx",
    "args": ["playwright", "test", "{files}"],
    "fullArgs": ["playwright", "test"],
    "maxArgumentCharacters": 20000
  }
}
```

Runner commands are executable/argument arrays. They are not shell command
strings. Local npm package bins such as Vitest and Playwright are resolved and
invoked through Node while preserving `shell: false`.

### Configure full-run triggers

Files that can affect the entire repository should force full execution:

```json
{
  "globalTriggers": [
    "rush.json",
    "common/config/**",
    "common/autoinstallers/**",
    "tsconfig*.json",
    "playwright.config.*",
    "playwright-codegraph.config.json",
    "test-scenarios.yml"
  ]
}
```

Files that cannot be represented safely in a source import graph can expand
only their owning Rush project:

```json
{
  "projectWideTriggers": [
    "**/package.json",
    "**/jest.config.*",
    "**/vitest.config.*"
  ]
}
```

## Create and maintain the graph

### Build the initial graph

Run this after installing dependencies:

```bash
npx playwright-codegraph graph build
```

The graph is stored under `.codegraph/`. Add that directory to `.gitignore`.
The initial build can be long-running in a large monorepo, so CI should cache
it.

### Check graph health

```bash
npx playwright-codegraph doctor
```

Expected output:

```text
codegraph 1.6.2
codegraph index: ready
```

`doctor` fails if the CLI is missing, the version is outside the supported
1.x protocol, or the index is not initialized.

### Synchronize after changes

```bash
npx playwright-codegraph graph sync
```

Planning and scenario validation also synchronize before trusting the graph.
Keeping a separate pipeline sync step makes failures visible earlier and allows
the expensive graph state to be cached.

### Force a complete rebuild

Use a rebuild after changing graph-engine versions, index configuration, or
large repository structure:

```bash
npx playwright-codegraph graph build --force
```

### Check raw codegraph status

The package-level health check is preferred, but the underlying engine can also
be inspected directly:

```bash
npx codegraph status --json .
npx codegraph files
```

Do not edit files inside `.codegraph/` manually. Rebuild the index when its
state is invalid.

## Inspect and use the graph

### Explain a changed source file

```bash
npx playwright-codegraph explain packages/cart/src/cart.ts
```

The command reports:

- The validated codegraph version.
- Test files reachable from the source file.
- Scenarios whose declared code paths match the file.
- Tests linked to those scenarios.

Example:

```json
{
  "affectedTests": [
    "apps/store/src/pricing.test.ts",
    "apps/e2e/tests/checkout.spec.ts",
    "packages/cart/src/cart.test.ts"
  ],
  "codegraphVersion": "1.6.2",
  "file": "packages/cart/src/cart.ts",
  "scenarioMatches": {
    "checkout.add-item": [
      "packages/cart/src/cart.test.ts"
    ]
  }
}
```

### Query affected tests with the raw engine

Bash:

```bash
printf "packages/cart/src/cart.ts\n" |
  npx codegraph affected --stdin --quiet --depth 12 --path .
```

PowerShell:

```powershell
'packages/cart/src/cart.ts' |
  npx codegraph affected --stdin --quiet --depth 12 --path .
```

Use the raw command for graph diagnosis. Use `playwright-codegraph plan` for CI
because the planner also applies Git, Rush, scenario, mapping, core/smoke, and
fail-open policies.

## Create customer journeys and scenarios

The scenario registry is a versioned YAML file. It separates business intent
from test implementation:

```yaml
schemaVersion: 1
customerJourneys:
  - id: commerce
    title: Commerce
    userJourneys:
      - id: checkout
        title: Complete checkout
        actor: shopper
        scenarios:
          - id: checkout.card-payment
            title: Pay by card
            criticality: critical
            requirementRefs:
              - REQ-CHECKOUT-1
            owners:
              - commerce
            tags:
              - smoke
              - payment
            codePaths:
              - apps/store/src/checkout/**
              - packages/payments/src/**
```

### Scenario authoring rules

1. Use stable IDs that do not depend on a test title.
2. Keep customer journey, user journey, and scenario IDs unique.
3. Declare code paths that implement the behavior, not unrelated bootstrap
   files.
4. Link at least one test to every scenario.
5. Ensure each resolved code file can reach a linked test through codegraph.
6. Use `criticality` to communicate business impact:
   `critical`, `high`, `medium`, or `low`.
7. Add requirement references and owners so gaps are actionable.

### Classify scenario types

Use the scenario `tags` array to describe the behavioral class. Scenario type
and criticality are different:

- **Type** describes the kind of behavior being exercised.
- **Criticality** describes the business impact if that behavior fails.

Recommended scenario types:

| Type | Purpose | Checkout example |
|---|---|---|
| `normal` | The most common expected user flow | Shopper buys one in-stock item |
| `happy-path` | End-to-end success with every dependency available | Card payment is authorized and order is created |
| `positive` | A valid alternative expected to succeed | Shopper applies a valid coupon |
| `negative` | Invalid, rejected, forbidden, or failed input/outcome | Card is declined or quantity is invalid |
| `edge` | A documented boundary value or state | Quantity is exactly the maximum allowed |
| `corner` | Multiple unusual conditions interacting | Maximum quantity, coupon, tax exemption, and split payment |
| `recovery` | Recovery after a known failure | Shopper retries after a payment timeout |
| `resilience` | Dependency degradation, timeout, or partial outage | Inventory service is temporarily unavailable |
| `security` | Authorization, data isolation, or abuse protection | Shopper cannot read another customer's order |
| `accessibility` | Keyboard, focus, names, roles, or visual access | Checkout can be completed using only the keyboard |

`normal`, `happy-path`, and `positive` can overlap, but they are not always
identical:

- Use `normal` for the statistically common route.
- Use `happy-path` for the canonical uninterrupted end-to-end success.
- Use `positive` for other valid variants that must also succeed.

Likewise:

- An `edge` case exercises one explicit boundary.
- A `corner` case combines boundaries, rare states, or multiple subsystems in a
  way that is individually valid but uncommon.

A scenario can have multiple tags:

```yaml
tags:
  - happy-path
  - positive
  - smoke
```

### Example journey with multiple scenario types

```yaml
schemaVersion: 1
customerJourneys:
  - id: commerce
    title: Commerce
    userJourneys:
      - id: checkout
        title: Complete checkout
        actor: shopper
        scenarios:
          - id: checkout.card.happy-path
            title: Complete checkout with an approved card
            criticality: critical
            requirementRefs: [REQ-CHECKOUT-1]
            owners: [commerce]
            tags: [normal, happy-path, positive, smoke]
            codePaths:
              - apps/store/src/checkout/**
              - packages/payments/src/card/**

          - id: checkout.coupon.positive
            title: Apply a valid coupon
            criticality: high
            requirementRefs: [REQ-CHECKOUT-2]
            owners: [commerce]
            tags: [positive]
            codePaths:
              - packages/promotions/src/**

          - id: checkout.card.declined
            title: Show a recoverable message for a declined card
            criticality: critical
            requirementRefs: [REQ-CHECKOUT-3]
            owners: [commerce, payments]
            tags: [negative, recovery]
            codePaths:
              - apps/store/src/checkout/**
              - packages/payments/src/card/**

          - id: checkout.quantity.maximum
            title: Purchase exactly the maximum allowed quantity
            criticality: medium
            requirementRefs: [REQ-CHECKOUT-4]
            owners: [commerce]
            tags: [edge, positive]
            codePaths:
              - packages/cart/src/quantity/**

          - id: checkout.split-payment.maximum-quantity
            title: Use split payment at maximum quantity with a coupon
            criticality: high
            requirementRefs: [REQ-CHECKOUT-4, REQ-CHECKOUT-5]
            owners: [commerce, payments]
            tags: [corner, positive]
            codePaths:
              - packages/cart/src/quantity/**
              - packages/promotions/src/**
              - packages/payments/src/split/**
```

Link each scenario ID to the test or tests that prove it:

```ts
test('approved card @scenario:checkout.card.happy-path', async ({ page }) => {
  // canonical success
});

test('declined card @scenario:checkout.card.declined', async ({ page }) => {
  // rejection and recovery behavior
});
```

### Journey coverage checklist

For each important user journey, consider:

- At least one normal or happy-path scenario.
- Material positive variants such as alternate payment, role, locale, or
  fulfillment methods.
- Negative scenarios for each validation, authorization, and business-rule
  rejection that matters.
- Edge scenarios at documented minimums, maximums, empty states, dates, sizes,
  and numerical boundaries.
- Corner scenarios for high-risk interactions between multiple boundaries or
  subsystems.
- Recovery and resilience scenarios for critical external dependencies.
- Security and accessibility scenarios where the journey carries those risks.

This is a risk-based checklist, not a requirement to create every category for
every journey. Do not create duplicate scenarios merely to satisfy labels.
Each scenario should describe a distinct observable behavior and map to a
requirement, risk, or known failure mode.

### Link unit tests

Use a file-level comment:

```ts
// @scenario checkout.card-payment
describe('card payment', () => {
  it('calculates the final amount', () => {
    // ...
  });
});
```

### Link Playwright tests

Use a title or tag-style annotation:

```ts
test('shopper pays by card @scenario:checkout.card-payment', async ({ page }) => {
  // ...
});
```

Both formats are statically inventoried. Unknown scenario IDs fail validation.

### Connect tests that cannot import product code

Browser tests often call a deployed system and cannot import application source
directly. Add an explicit mapping:

```json
{
  "mappings": [
    {
      "when": [
        "packages/payments/src/**",
        "apps/store/src/checkout/**"
      ],
      "tests": [
        "apps/e2e/tests/checkout/**/*.spec.ts"
      ]
    }
  ]
}
```

Scenario code paths provide an additional deterministic safety edge: when a
changed file matches a scenario, all tests linked to that scenario are added to
the plan.

## Validate scenario coverage

Run the static scenario gate:

```bash
npx playwright-codegraph scenarios
```

Generated files:

- `test-selection-out/scenario-coverage.json`
- `test-selection-out/scenario-coverage.md`

The command exits with code 2 when gaps exist. Typical gaps include:

- Duplicate journey or scenario IDs.
- An unknown `@scenario` annotation.
- A scenario without linked tests.
- A code-path glob that resolves no files.
- A code file that cannot reach a test linked to the same scenario.

### Add LCOV runtime evidence

```bash
npx playwright-codegraph scenarios --lcov coverage/lcov.info
```

### Add V8 runtime evidence

```bash
npx playwright-codegraph scenarios --v8 coverage/coverage-final.json
```

Static and runtime evidence are intentionally separate:

- **Static evidence**: codegraph can reach a scenario-linked test from a
  declared source file.
- **Runtime evidence**: an instrumented run observed executed code in the file.

Set `scenarios.requireRuntimeEvidence` to `true` only when CI always provides
the selected runtime artifact.

## Select and run tests locally

Fetch the target branch so a merge base can be calculated:

```bash
git fetch origin main
```

Create a plan:

```bash
npx playwright-codegraph plan --base origin/main
```

The local plan includes:

- Committed changes since the merge base.
- Staged changes.
- Unstaged changes.
- Renames and deletions.
- Untracked files when `includeUntracked` is enabled.

Inspect the plan before execution:

```bash
node -e "const p=require('./test-selection-out/plan.json'); console.log(p.mode, p.tests.map(t => [t.path, t.reasons]))"
```

Run it:

```bash
npx playwright-codegraph run
```

`run` preserves child-process exit codes. In full mode, it uses the configured
`unit.fullArgs` and `playwright.fullArgs`.

### Select against a local branch

```bash
npx playwright-codegraph plan --base main
npx playwright-codegraph run
```

This is useful after creating a local baseline commit, as demonstrated by the
two-package example.

## Run selective tests on a pull request

The checkout must include full history:

```yaml
name: Selective PR tests

on:
  pull_request:

jobs:
  affected:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - uses: actions/cache@v4
        with:
          path: .codegraph
          key: >-
            codegraph-${{ runner.os }}-${{
              hashFiles(
                'package-lock.json',
                'rush.json',
                'common/config/**',
                'playwright-codegraph.config.json',
                'test-scenarios.yml'
              )
            }}
          restore-keys: |
            codegraph-${{ runner.os }}-

      - name: Build or synchronize graph
        shell: bash
        run: |
          if npx playwright-codegraph graph status; then
            npx playwright-codegraph graph sync
          else
            npx playwright-codegraph graph build
          fi

      - name: Validate scenarios
        run: npx playwright-codegraph scenarios

      - name: Create deterministic PR plan
        run: npx playwright-codegraph plan --base origin/${{ github.base_ref }}

      - name: Run selected tests
        run: npx playwright-codegraph run

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-selection
          path: test-selection-out/
```

For Azure Pipelines, use
[`examples/azure-pipelines.yml`](./examples/azure-pipelines.yml).

### Pull-request behavior

| PR change | Expected policy |
|---|---|
| Source file | Codegraph-reachable tests plus Rush/scenario safety tests |
| Unit or Playwright test | The changed test always runs |
| Deleted source file | All unit tests in the owning Rush project |
| Non-code project file | All unit tests in the owning Rush project |
| Direct dependency package | Tests of configured direct Rush dependents |
| Distant dependency package | Matching smoke tests |
| Global configuration | Full unit and Playwright commands |
| Unknown root file | Full unit and Playwright commands |
| Documentation-only ignored file | Only configured core safety tests |

## Run all tests in CI

Selective PR testing should supplement, not eliminate, a regular full-suite
workflow. Run full tests on protected branches, schedules, releases, or before
deployment.

```yaml
name: Full test suite

on:
  push:
    branches:
      - main
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  full:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:e2e
```

Use the repository's native full commands here. They should match the
`unit.fullArgs` and `playwright.fullArgs` commands in
`playwright-codegraph.config.json`.

To measure selective safety while retaining a full authoritative result:

```bash
npx playwright-codegraph shadow --base origin/main
```

## Exercise common change scenarios

The following checks are useful when onboarding the framework.

### Scenario 1: Direct source change

1. Change a TypeScript source file.
2. Run `graph sync`.
3. Run `explain <file>`.
4. Run `plan`.
5. Confirm reachable tests have a `codegraph-reachable` reason.

### Scenario 2: Cross-package Rush dependency

1. Change a library used by another Rush project.
2. Run `plan`.
3. Confirm direct-dependent unit tests have a `dependent-project` reason.
4. Confirm distant smoke tests have a `smoke-safety` reason when configured.

### Scenario 3: Customer journey code path

1. Change a file matched by a scenario's `codePaths`.
2. Run `plan`.
3. Confirm tests linked to that scenario have a `covers` reason.

### Scenario 4: Changed test

1. Change a unit or Playwright test.
2. Run `plan`.
3. Confirm the test has a `changed-test` reason.

### Scenario 5: Deleted source file

1. Delete a source file.
2. Run `plan`.
3. Confirm owning-project unit tests have a `project-expansion` reason.

Deleted files cannot be queried in the current graph, so project expansion is
the safe deterministic behavior.

### Scenario 6: Global trigger

1. Change `rush.json`, shared TypeScript configuration, or another configured
   global trigger.
2. Run `plan`.
3. Confirm `mode` is `full` and `fullRunReasons` contains `global-trigger`.

### Scenario 7: Unknown repository file

1. Add a non-ignored file outside every Rush project.
2. Run `plan`.
3. Confirm the planner fails open with `unknown-file`.

### Scenario 8: Scenario coverage gap

1. Add a scenario without a test annotation.
2. Run `scenarios`; confirm exit code 2.
3. Run `plan`; confirm it expands to full execution with `unsafe-input`.

### Scenario 9: Missing or stale graph

1. Temporarily move `.codegraph` outside the repository.
2. Run `plan`.
3. Confirm a full plan with `codegraph-failed` or
   `codegraph-unavailable`.
4. Restore safety with `graph build`.

Do not perform this check in a shared working directory without preserving the
existing index.

### Scenario 10: Selection limit

Set a low `maxSelectedUnitFiles` or `maxSelectedPlaywrightFiles`, then create a
change that exceeds it. The planner must produce a full plan with
`selection-limit`; it must never truncate the affected list.

## Measure selection safety

### Shadow execution

```bash
npx playwright-codegraph shadow --base origin/main
```

Shadow mode:

1. Creates the normal plan.
2. Runs the selective plan.
3. Runs the full configured commands.
4. Treats the full result as authoritative.
5. Records whether selective execution missed a full-suite failure.

Output:

```text
test-selection-out/shadow.json
```

### Retain shadow history

Copy shadow artifacts into a history directory organized by build or commit:

```text
test-selection-history/
  build-100/shadow.json
  build-101/shadow.json
  build-102/shadow.json
```

Aggregate them:

```bash
npx playwright-codegraph replay --records test-selection-history
```

The replay command reports:

- Number of records.
- Selective passes.
- Full failures.
- Missed failures.
- Full-fallback runs.

It exits with code 2 when retained records contain a missed failure.

## Read the generated artifacts

### `plan.json`

Important fields:

| Field | Meaning |
|---|---|
| `schemaVersion` | Version of the public plan contract |
| `inputFingerprint` | Hash of deterministic planning inputs |
| `mode` | `empty`, `selective`, or `full` |
| `changedFiles` | Normalized Git changes used by the planner |
| `changedProjects` | Owning Rush projects |
| `tests` | Selected unit and Playwright test files |
| `tests[].reasons` | Every deterministic reason for selection |
| `fullRunReasons` | Reasons selective execution was unsafe |

Print selected paths:

```bash
node -e "const p=require('./test-selection-out/plan.json'); for(const t of p.tests) console.log(t.kind, t.path)"
```

Print full-run reasons:

```bash
node -e "const p=require('./test-selection-out/plan.json'); console.log(p.fullRunReasons)"
```

### `execution.json`

Contains:

- The plan fingerprint.
- Execution mode.
- Exact executable and argument arrays.
- Exit codes.

It intentionally does not persist child stdout/stderr, reducing the chance of
writing credentials or environment data into artifacts.

### Scenario coverage artifacts

The JSON file is intended for automation. The Markdown matrix is intended for
humans and pull-request artifacts.

Keep generated artifacts out of source control:

```gitignore
.codegraph/
test-selection-out/
```

## Troubleshoot graph and selection failures

### `codegraph index is not initialized`

```bash
npx playwright-codegraph graph build
npx playwright-codegraph doctor
```

### `Could not find a merge-base`

- Use a full CI checkout (`fetch-depth: 0`).
- Fetch the target branch.
- Verify the supplied base ref exists.

```bash
git fetch origin main
git merge-base HEAD origin/main
```

### `codegraph ... is outside the supported 1.x protocol`

Install a supported version:

```bash
npm install --save-dev @colbymchenry/codegraph@1.6.2
```

Then rebuild:

```bash
npx playwright-codegraph graph build --force
```

### Scenario path resolves no files

- Run the glob from the repository root.
- Use `/` separators in registry paths.
- Confirm generated or ignored files are not being referenced.
- Prefer business source files over server bootstrap/configuration files.

### Scenario test is not statically linked

- Confirm the test imports the relevant product module or helper chain.
- Use `explain <source-file>`.
- Inspect raw `codegraph affected` output.
- For remote-system Playwright tests, add an explicit mapping.
- Do not mark a gap as covered solely because a test title sounds related.

### Plan unexpectedly runs everything

Inspect:

```bash
node -e "const p=require('./test-selection-out/plan.json'); console.log(p.fullRunReasons)"
```

Common causes:

- Global trigger changed.
- Unknown file outside Rush projects.
- Scenario coverage gap.
- Missing graph.
- Incomplete Git history.
- Too many selected files.
- Command-line argument limit exceeded.

### Plan unexpectedly selects nothing

1. Check ignored-change patterns.
2. Run `explain` for the changed source.
3. Validate the scenario matrix.
4. Confirm unit and Playwright globs match actual files.
5. Confirm every source file belongs to a Rush project.
6. Run `doctor` and `graph sync`.

If the planner cannot classify an input safely, it should produce a full plan,
not an empty selective plan. Treat an unexplained empty plan as a defect.

## Complete walkthrough

The fastest end-to-end exercise is the included example:

```bash
cd examples/rush-two-package
npm install
npm run build
npm run test:all

git init -b main
git config user.email "demo@example.com"
git config user.name "Demo User"
git add .
git commit -m "baseline"

npm run graph:build
npm run doctor
npm run scenarios
```

Change `packages/math-core/src/index.ts`, then run:

```bash
npm run plan
npm run explain:math
npm run run:selected
```

The expected plan is selective and crosses the package boundary from
`@demo/math-core` to `@demo/store-app`.
