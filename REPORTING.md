# Unified HTML Reporting

`playwright-codegraph` generates a standalone HTML dashboard from the
deterministic artifacts produced by local, pull-request, scenario, CI, shadow,
and replay workflows.

The report is self-contained:

- Inline CSS and JavaScript.
- No external fonts, stylesheets, scripts, or network requests.
- Content Security Policy restricting external resources.
- Escaped repository paths, titles, reasons, and command arguments.
- Printable sections and keyboard-accessible navigation.

## Generate a report

After creating one or more artifacts:

```bash
npx playwright-codegraph report
```

Default output:

```text
test-selection-out/codegraph-report.html
```

Custom paths and title:

```bash
npx playwright-codegraph report \
  --artifacts test-selection-out \
  --out artifacts/pr-quality-report.html \
  --title "Checkout PR Quality Report"
```

At least one recognized artifact must exist. Invalid JSON fails explicitly.

## Dashboard sections

### Unified overview

Shows:

- Overall readiness or action-required state.
- Selective, empty, or full plan mode.
- Selected test count.
- Scenario and gap counts.
- Execution result.
- Input fingerprint.
- Full-run safety reasons.

### PR impact

Reads `plan.json` and shows:

- Changed files and statuses.
- Changed Rush projects.
- Unit and Playwright tests.
- Core, smoke, and full buckets.
- Every reason that selected each test.
- Full-run fallback reasons.
- Interactive test filtering.

### Scenario coverage

Reads `scenario-coverage.json` and shows:

- Scenario count.
- Linked tests.
- Resolved code paths.
- Static codegraph links.
- Observed runtime files.
- Coverage gaps.

Static reachability and runtime evidence remain separate.

### CI execution

Reads `execution.json` and shows:

- Selective or full execution mode.
- Overall exit code.
- Unit and Playwright commands.
- Executables and arguments.
- Per-command exit codes.

Child stdout and stderr are not persisted in the execution artifact.

### Shadow and replay

Reads `shadow.json` and `replay.json` and shows:

- Selective and authoritative full exit codes.
- Whether selective execution missed a full-suite failure.
- Historical record count.
- Full failures.
- Missed failures.
- Full-fallback frequency.

## Scenario test report

```bash
npx playwright-codegraph graph sync
npx playwright-codegraph scenarios
npx playwright-codegraph report --title "Scenario Coverage"
```

Add optional runtime evidence:

```bash
npx playwright-codegraph scenarios --lcov coverage/lcov.info
npx playwright-codegraph report --title "Scenario Coverage with LCOV"
```

Or:

```bash
npx playwright-codegraph scenarios --v8 coverage/coverage-final.json
npx playwright-codegraph report --title "Scenario Coverage with V8 Evidence"
```

## Pull-request selective report

```bash
git fetch origin main
npx playwright-codegraph graph sync
npx playwright-codegraph scenarios
npx playwright-codegraph plan --base origin/main
npx playwright-codegraph run
npx playwright-codegraph report --title "Pull Request Impact"
```

Publish the entire `test-selection-out` directory so the standalone report and
its machine-readable source artifacts remain together.

## Full CI report

Use explicit full planning for protected branches, scheduled builds, releases,
or pre-deployment verification:

```bash
npx playwright-codegraph graph sync
npx playwright-codegraph scenarios
npx playwright-codegraph plan --base HEAD --full
npx playwright-codegraph run
npx playwright-codegraph report --title "Full CI Quality Report"
```

`plan --full` records `manual-full-run` in `fullRunReasons`. The executor uses
the configured `unit.fullArgs` and `playwright.fullArgs`, and the resulting
`execution.json` feeds the CI section.

## Shadow safety report

```bash
npx playwright-codegraph shadow --base origin/main
npx playwright-codegraph report --title "Selection Safety Report"
```

For historical analysis:

```bash
npx playwright-codegraph replay --records test-selection-history
npx playwright-codegraph report --title "Selection Reliability History"
```

## GitHub Actions

```yaml
- name: Validate scenarios
  run: npx playwright-codegraph scenarios

- name: Plan PR tests
  run: npx playwright-codegraph plan --base origin/${{ github.base_ref }}

- name: Run planned tests
  run: npx playwright-codegraph run

- name: Generate standalone quality report
  if: always()
  run: npx playwright-codegraph report --title "PR #${{ github.event.pull_request.number }} Quality"

- name: Publish quality report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: codegraph-quality-report
    path: test-selection-out/
```

If an earlier step fails before producing any recognized artifact, the report
command fails instead of writing a success-shaped empty report.

## Azure Pipelines

```yaml
- script: npx playwright-codegraph scenarios
  displayName: Validate scenarios

- script: npx playwright-codegraph plan --base origin/$(System.PullRequest.TargetBranchName)
  displayName: Plan PR tests

- script: npx playwright-codegraph run
  displayName: Run planned tests

- script: npx playwright-codegraph report --title "Build $(Build.BuildNumber) Quality"
  condition: always()
  displayName: Generate quality report

- task: PublishPipelineArtifact@1
  condition: always()
  inputs:
    targetPath: test-selection-out
    artifact: codegraph-quality-report
```

## Product scope

The current package deterministically:

- Maps code and Rush dependencies.
- Identifies changed and impacted flows.
- Selects and runs existing unit, integration, and Playwright tests.
- Reports missing scenario/code-path coverage.
- Produces a unified quality view for developers and QA teams.
- Keeps humans in control of review and release decisions.

It does **not** currently use AI to generate new tests. Coverage gaps are
explicit inputs for a human or a separate test-authoring workflow. This avoids
claiming generated tests are valid before they have been reviewed and proven.
