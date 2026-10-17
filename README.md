# playwright-codegraph

Deterministic, fail-open affected-test selection and scenario coverage for
Rush-based TypeScript repositories. File-level reachability is provided by the
required [`@colbymchenry/codegraph`](https://www.npmjs.com/package/@colbymchenry/codegraph)
CLI.

## Reliability contract

`playwright-codegraph` does not claim that networks, browsers, application code,
or tests can never be nondeterministic. It makes the **selection layer**
deterministic and safe:

- Identical Git, config, Rush, scenario, test-inventory, and codegraph inputs
  produce byte-identical `plan.json` output.
- Timestamps and durations are written only to execution records.
- Missing or stale graphs, incomplete Git history, invalid configuration,
  deleted/ungraphable files, unknown repository changes, malformed tool output,
  timeouts, and selection limits expand to a full run.
- A limit never silently drops affected tests.
- Every selected test and fallback has a stable reason.

## Capabilities

- Three-dot merge-base changes plus staged, unstaged, renamed, deleted, and
  optionally untracked files.
- Rush project ownership and dependency/dependent modeling.
- Required codegraph build, sync, status, version, and affected-test operations.
- Separate unit and Playwright selection and execution.
- Global triggers, project-wide expansion, explicit mappings, and core tests.
- Customer journey, user journey, and scenario registry.
- `@scenario` links from unit and Playwright tests.
- Scenario-to-code-path validation through codegraph.
- Optional LCOV runtime evidence, kept separate from static reachability.
- Canonical JSON plans and scenario reports plus a Markdown coverage matrix.

## Install

```bash
npm install --save-dev playwright-codegraph @colbymchenry/codegraph
```

Node.js 20 or newer is required.

Copy the examples:

```bash
cp node_modules/playwright-codegraph/playwright-codegraph.config.example.json playwright-codegraph.config.json
cp node_modules/playwright-codegraph/test-scenarios.example.yml test-scenarios.yml
```

## Define journeys and scenarios

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
            requirementRefs: [REQ-CHECKOUT-1]
            owners: [commerce]
            tags: [smoke]
            codePaths:
              - apps/store/src/checkout/**
              - packages/payments/src/**
```

Link a whole test file or a Playwright test title/tag:

```ts
// @scenario checkout.card-payment
test('shopper pays by card @scenario:checkout.card-payment', async ({ page }) => {
  // ...
});
```

Static coverage means that codegraph maps a declared code path to a test linked
to the same scenario. Runtime coverage means an optional LCOV artifact observed
executed lines in that file. Reports label these independently.

## Commands

```bash
# Long-running graph step, suitable for a cached build-pipeline job
npx playwright-codegraph graph build
npx playwright-codegraph graph sync
npx playwright-codegraph doctor

# Deterministic selection and execution
npx playwright-codegraph plan --base origin/main
npx playwright-codegraph run

# Measure safety: the full result is authoritative
npx playwright-codegraph shadow --base origin/main

# Aggregate retained shadow records and fail on missed failures
npx playwright-codegraph replay --records test-selection-history

# Scenario gate and optional runtime evidence
npx playwright-codegraph scenarios
npx playwright-codegraph scenarios --lcov coverage/lcov.info
npx playwright-codegraph scenarios --v8 coverage/coverage-final.json
```

Outputs default to:

- `test-selection-out/plan.json`
- `test-selection-out/execution.json`
- `test-selection-out/scenario-coverage.json`
- `test-selection-out/scenario-coverage.md`
- `test-selection-out/shadow.json`
- `test-selection-out/replay.json`

The scenario command exits with code 2 when the registry has coverage gaps.

## Configuration

See
[`playwright-codegraph.config.example.json`](./playwright-codegraph.config.example.json).
Runner commands use an executable and argument array and are always spawned
with `shell: false`. `{files}` is replaced by the selected paths. If the
resulting command exceeds `maxArgumentCharacters`, that runner uses its
`fullArgs` instead.

## CI model

Graph generation is intentionally separate because a full index can be
long-running:

1. Restore `.codegraph` using a key derived from the codegraph version, lockfile,
   Rush configuration, and selector configuration.
2. Run `graph sync`; run `graph build` when no valid index exists.
3. Generate and publish the plan and scenario matrix.
4. Execute the plan. Any unsafe planner input produces a full-run plan.

See [the GitHub example](./.github/workflows/affected.yml) and
[the Azure Pipelines example](./examples/azure-pipelines.yml).

## Current boundaries

- Rush workspaces are the v1 workspace model.
- `@colbymchenry/codegraph` 1.6.2 or newer in the 1.x line is required.
- Scenario code paths are file globs. Symbol-level scenario declarations are not
  part of v1.
- Runtime evidence is optional unless `scenarios.requireRuntimeEvidence` is set.
- A static link proves dependency reachability, not that an assertion validated
  every branch in the file.

## License

MIT. See [third-party notices](./THIRD_PARTY_NOTICES.md).
