# Product Vision and Feature Roadmap

## Product thesis

`playwright-codegraph` should become the trusted scenario-coverage and
change-based test intelligence layer for modern engineering organizations.

The product promise is:

> Understand every code change, map it to customer and user journeys, run the
> smallest provably safe test set, expose every coverage gap, and keep humans in
> control.

The product should not compete as another test runner. It should connect code,
requirements, scenarios, tests, runtime evidence, and CI decisions into one
deterministic quality system.

## Positioning

### Category

**Deterministic Test Impact and Scenario Coverage Intelligence**

### One-line pitch

Map code changes to customer journeys and run only the tests that matter,
without silently risking missed regressions.

### Short pitch

CodeGraph builds a deterministic map of source code, package dependencies,
customer journeys, scenarios, and tests. For every pull request, it explains
what changed, which user flows are affected, which tests prove those flows, and
where coverage is missing. It runs a safe selective test plan and fails open to
the full suite whenever confidence is incomplete.

### Core differentiators

1. **Scenario-first, not file-first**
   - Changes are mapped to business journeys and observable scenarios, not only
     test files.
2. **Deterministic trust layer**
   - AI may explain or draft, but deterministic evidence controls whether tests
     can be safely skipped.
3. **Fail-open safety**
   - Missing graph data, unknown files, stale mappings, and coverage gaps expand
     to full execution.
4. **Full-stack selection**
   - Unit, integration, API, component, and Playwright tests share one impact
     model.
5. **Every decision is explainable**
   - Every selected test and every fallback has machine-readable reasons.
6. **Human control**
   - Teams own journeys, policies, approvals, and release decisions.
7. **Works with existing tests**
   - Adoption does not require replacing the current test framework.

## Ideal customers

### Primary users

- QA and test-platform teams managing long CI suites.
- Developers maintaining large TypeScript monorepos.
- Engineering productivity teams responsible for CI cost and feedback time.
- Release managers who need confidence evidence.
- Product and quality leaders who need journey-level coverage visibility.

### Best initial customer profile

- TypeScript monorepo.
- Hundreds or thousands of unit and Playwright tests.
- Pull-request feedback slower than 15 minutes.
- Rush, npm, pnpm, or Yarn workspace structure.
- Important customer journeys distributed across multiple packages.
- Existing CI artifacts but no unified impact or coverage view.

## Current foundation

The product already has a strong deterministic base:

- Git merge-base and working-tree change detection.
- Rush ownership and dependent-project modeling.
- Required codegraph reachability.
- Unit and Playwright selective execution.
- Customer journey, user journey, and scenario registry.
- `@scenario` test linkage.
- Static and optional runtime coverage evidence.
- Project, mapping, core, smoke, and scenario safety edges.
- Canonical plans with explicit reasons.
- Full-suite safety fallback.
- Shadow execution and replay aggregation.
- GitHub Actions and Azure Pipelines examples.
- A working two-package integration example.

The next features should strengthen adoption, trust, breadth, and commercial
value without weakening deterministic guarantees.

## Product principles

### Deterministic core, optional AI

AI must never be the sole reason to skip a test. AI can:

- Explain impact.
- Suggest scenario definitions.
- Draft missing tests.
- Summarize failures.
- Recommend priorities.

Deterministic graph, coverage, policy, and execution evidence must decide
whether selection is safe.

### Evidence before claims

The product must distinguish:

- Declared coverage.
- Static graph reachability.
- Observed runtime coverage.
- Passing execution.
- Assertion strength.
- Historical reliability.

No single signal should be presented as "100% covered."

### Safe degradation

Every unavailable or ambiguous input must produce one of:

- A known project-level expansion.
- A full-suite plan.
- A blocked policy decision with an explicit error.

It must never produce an unexplained empty plan.

### Incremental adoption

Teams should gain value in this order:

1. Install and inspect impact.
2. Run shadow mode.
3. Add scenario mappings.
4. Measure misses and fallback rate.
5. Enable non-blocking selective CI.
6. Promote selection to the required PR gate.

## P0: Launch-critical features

These features create a complete, sellable first product.

### 1. Universal monorepo discovery

**Goal:** Work in small and large monorepos without requiring Rush.

Support:

- Rush projects.
- npm workspaces.
- pnpm workspaces.
- Yarn workspaces.
- GitHub-hosted and local repositories.
- Explicit project configuration as an escape hatch.
- Single-package repositories.

Required behavior:

- Auto-detect workspace type.
- Normalize package names and folders.
- Model dependencies, dev dependencies, optional dependencies, and peer
  dependencies according to policy.
- Detect duplicate names and overlapping project folders.
- Explain the discovered workspace.
- Scale to thousands of packages.
- Cache workspace metadata by manifest and lockfile hash.

Proposed command:

```bash
playwright-codegraph workspace inspect
```

Commercial value:

- Expands the addressable market beyond Rush.
- Reduces onboarding work.
- Supports both startup and enterprise monorepos.

### 2. Unified standalone HTML quality report

**Goal:** Give developers, QA, and leadership one shared quality view.

Sections:

- Pull-request impact.
- Changed projects and files.
- Prioritized selected tests.
- Customer and user journeys.
- Scenario coverage and gaps.
- Static and runtime evidence.
- Unit, integration, and end-to-end execution.
- Full-run fallback reasons.
- Shadow missed-failure analysis.
- Historical replay metrics.

Requirements:

- One standalone HTML file.
- No external scripts or stylesheets.
- Accessible navigation and tables.
- Printable and artifact-friendly.
- Safe HTML escaping and strict CSP.
- JSON source artifacts remain available.

### 3. Test result adapters

**Goal:** Report individual tests, not only command exit codes.

Import:

- Playwright JSON and blob reports.
- JUnit XML.
- Vitest JSON.
- Jest JSON.
- Mocha JSON.
- Coverage formats such as LCOV, Istanbul, and V8.

Normalize into:

```text
Test identity
Framework
Project/package
Scenario IDs
Status
Duration
Retries
Failure category
Artifacts
```

Commercial value:

- Creates the unified quality view.
- Enables historical reliability and prioritization.
- Makes reports useful to QA teams, not only build engineers.

### 4. GitHub pull-request integration

**Goal:** Put impact and quality evidence where developers already review code.

Features:

- GitHub Check with pass, warn, fallback, and fail states.
- Summary PR comment updated in place.
- Changed journeys and scenarios.
- Selected tests grouped by reason and priority.
- Coverage-gap annotations.
- Links to the standalone HTML report.
- Required policy checks.
- No duplicate comments.

Example PR summary:

```text
3 packages changed
2 customer journeys affected
18 of 2,430 tests selected
4m 12s estimated time saved
0 scenario gaps
Selection confidence: Verified
```

### 5. Scenario policy engine

**Goal:** Turn scenario coverage into enforceable quality policy.

Policies:

- Critical scenarios must have at least one linked test.
- Critical code paths must have a static graph link.
- Selected critical scenarios must pass.
- Runtime evidence required for configured journeys.
- Negative and boundary coverage required for selected business rules.
- No unknown scenario annotations.
- No stale requirement references.
- Maximum allowed fallback rate.
- Maximum missed-failure rate.

Proposed configuration:

```yaml
policies:
  critical:
    requireLinkedTest: true
    requireStaticLink: true
    requirePassingExecution: true
  pullRequest:
    blockOnScenarioGap: true
    maxFallbackRate: 0.10
```

### 6. Scenario taxonomy as a first-class field

**Goal:** Make scenario quality measurable and searchable.

Types:

- Normal.
- Happy path.
- Positive.
- Negative.
- Edge.
- Corner.
- Recovery.
- Resilience.
- Security.
- Accessibility.
- Performance.
- Data migration.

Add a typed `type` or `types` field instead of relying only on free-form tags.

Reports should answer:

- Which critical journeys lack a happy path?
- Which validation rules lack negative coverage?
- Which boundaries have no edge tests?
- Which external dependencies lack recovery scenarios?

### 7. Fast onboarding

**Goal:** Reach the first useful report in less than 15 minutes.

Commands:

```bash
playwright-codegraph init
playwright-codegraph doctor
playwright-codegraph workspace inspect
playwright-codegraph graph build
playwright-codegraph scenario discover
```

`init` should:

- Detect workspace type.
- Detect test frameworks.
- Suggest test globs and runner commands.
- Generate a safe initial configuration.
- Never overwrite existing files without approval.
- Start in shadow mode.

### 8. Graph confidence and health

**Goal:** Make graph quality visible and governable.

Metrics:

- Indexed source-file percentage.
- Unresolved import count.
- Cross-package edge count.
- Stale-index status.
- Changed files missing from graph.
- Tests with no incoming source edge.
- Packages with dependents but no cross-package test edge.

States:

- Verified.
- Degraded.
- Unsafe.

Only `Verified` should permit blocking selective execution.

## P1: Differentiating intelligence

### 9. Prioritized impact scoring

Rank tests and scenarios using deterministic signals:

- Direct graph distance.
- Scenario criticality.
- Changed symbol visibility.
- Package dependency distance.
- Runtime coverage overlap.
- Historical failure correlation.
- Test duration.
- Flake rate.
- Ownership.

The score should prioritize execution order, not silently remove affected tests.

### 10. Runtime-enhanced graph

Combine:

- Static dependency edges.
- Runtime coverage edges.
- API contract edges.
- Event/topic dependencies.
- Database migration dependencies.
- Feature-flag dependencies.

Keep the source and confidence of every edge.

### 11. Historical reliability learning

Store:

- Plan fingerprint.
- Selected and full outcomes.
- Missed failures.
- Fallback reasons.
- Test durations.
- Flake signatures.
- Changed files and scenarios.

Use history to:

- Prove selection safety.
- Estimate time savings.
- Detect drift.
- Recommend mapping improvements.
- Identify tests that never add signal.

Historical data must not override deterministic safety policy by itself.

### 12. Coverage gap recommendations

When coverage is missing, report:

- Uncovered scenario.
- Source files and symbols.
- Closest existing tests.
- Recommended test layer: unit, integration, API, or end-to-end.
- Suggested owner.
- Requirement and risk context.

This is valuable even without automatic test generation.

### 13. Human-gated AI test authoring

**Goal:** Draft missing tests without reducing trust.

Workflow:

1. Deterministic engine identifies a specific coverage gap.
2. AI drafts a test for the linked scenario and code path.
3. The test is executed in isolation.
4. Mutation or negative-control validation proves it can fail.
5. Existing affected and full suites run.
6. A human reviews the draft PR.

Guardrails:

- Never merge automatically.
- Never weaken assertions.
- Never add sleeps, retries, or skipped tests to pass.
- Never claim coverage before the test passes for the right reason.
- Preserve scenario and requirement links.

### 14. Failure classification

Classify failures as:

- Product.
- Test defect.
- Flaky/timing.
- Infrastructure.
- Environment/data.
- Unknown.

Use test artifacts, console, network, trace, screenshot, and recent diff.
Separate observation from inference and retain human approval.

### 15. Flaky-test intelligence

Features:

- Stable test identity across renames.
- Flake rate by branch/environment/browser.
- Failure-signature clustering.
- Order-dependence detection.
- Retry masking detection.
- Quarantine policy with expiry and owner.
- Scenario risk retained while quarantined.

Flaky tests should never be silently treated as passing coverage.

### 16. Change-to-requirement traceability

Connect:

```text
Requirement
  -> customer journey
  -> user journey
  -> scenario
  -> test
  -> code path
  -> execution
  -> release evidence
```

Integrations:

- GitHub Issues.
- Azure DevOps work items.
- Jira.
- Markdown requirement IDs.
- OpenAPI operations.

### 17. Multi-language code intelligence

Expand beyond TypeScript:

- JavaScript.
- Python.
- Java/Kotlin.
- C#.
- Go.
- Rust.

Use language-specific graph adapters behind one normalized contract. Never
pretend all languages have the same edge confidence.

## P2: Enterprise platform

### 18. Organization quality portal

Portfolio views:

- Repositories and teams.
- Critical journey coverage.
- PR selection rate.
- Fallback rate.
- Missed-failure rate.
- Test time saved.
- Flake rate.
- Coverage debt.
- Release readiness.

### 19. Self-hosted and data-control options

- Local-only CLI.
- Self-hosted service.
- SaaS control plane with no source upload.
- Configurable retention.
- Regional data residency.
- Customer-managed encryption keys.
- Proxy and private-network support.

### 20. Enterprise access and governance

- SSO/SAML.
- SCIM.
- Role-based access control.
- Audit logs.
- Signed artifacts.
- Policy versioning.
- Approval workflows.
- Branch and environment policies.
- Exception requests with expiry.

### 21. Multi-CI support

First-class integrations:

- GitHub Actions.
- Azure Pipelines.
- GitLab CI.
- Jenkins.
- CircleCI.
- Buildkite.

Each integration should publish the same normalized plan, execution, and report
contracts.

### 22. Distributed and sharded execution

- Deterministic test sharding.
- Historical duration balancing.
- Shard-safe setup/teardown handling.
- Result merging.
- Partial-shard failure visibility.
- Full report reconstruction.
- Retry ownership without duplicate tests.

### 23. API and extension platform

- Versioned TypeScript API.
- REST/GraphQL service API.
- Webhooks.
- Custom graph adapters.
- Custom scenario validators.
- Custom test result adapters.
- Custom report sections.
- Policy plugins.

## Product packaging

### Community

- Local CLI.
- Rush/npm/pnpm/Yarn discovery.
- Static graph selection.
- Scenario registry.
- JSON/Markdown/HTML reports.
- GitHub Actions examples.
- Local shadow mode.

### Team

- GitHub Check and PR comments.
- Historical metrics.
- Result adapters.
- Runtime-enhanced edges.
- Shared policies.
- Flake intelligence.
- Team dashboard.

### Enterprise

- Self-hosting.
- SSO/SCIM/RBAC.
- Portfolio dashboard.
- Audit and policy governance.
- Data residency.
- Multi-CI support.
- Priority support and onboarding.

The free tier should prove technical trust. Paid tiers should monetize
collaboration, history, governance, scale, and enterprise operation rather than
locking basic safety behind a paywall.

## Measurable customer outcomes

The product should report outcomes using evidence:

- Median PR test duration before and after adoption.
- Percentage of tests selected.
- Full-suite fallback rate.
- Missed-failure rate from shadow mode.
- Critical scenario coverage.
- Static-link coverage.
- Runtime-evidence coverage.
- Time from code change to first trusted result.
- CI compute hours saved.
- Flake-related reruns avoided.
- Coverage gaps resolved.

Avoid unqualified claims such as "100% reliable" or "never misses bugs."
Preferred claims:

- Deterministic for identical inputs.
- Fail-open when evidence is incomplete.
- Measured missed-failure rate.
- Verified graph health.
- Explicit scenario coverage.

## Competitive moat

The defensible system is the combined data model:

```text
Code graph
+ workspace graph
+ scenario graph
+ runtime evidence
+ execution history
+ human policy
= trusted quality intelligence
```

Individual test-selection algorithms can be copied. A long-lived,
evidence-backed relationship graph with historical safety proof, scenario
ownership, and organization policy is much harder to replace.

## Recommended delivery order

| Order | Feature | Customer value | Complexity | Why now |
|---:|---|---:|---:|---|
| 1 | Universal workspace discovery | Very high | Medium | Expands market immediately |
| 2 | Unified HTML report | Very high | Medium | Makes value visible |
| 3 | Result adapters | Very high | Medium | Enables real quality reporting |
| 4 | GitHub PR integration | Very high | Medium | Fits developer workflow |
| 5 | Scenario policy engine | High | Medium | Converts insight into governance |
| 6 | Graph health/confidence | High | Medium | Required for trust |
| 7 | Fast onboarding | High | Medium | Reduces adoption friction |
| 8 | Historical reliability | High | High | Proves ROI and safety |
| 9 | Runtime-enhanced graph | High | High | Improves precision |
| 10 | Human-gated AI authoring | High | High | Differentiates after trust exists |

## Definition of a market-ready v1

The product is ready for external pilot customers when:

- Rush, npm, pnpm, and Yarn monorepos are supported.
- A new repository can onboard in under 15 minutes.
- Graph health is visible.
- Scenario coverage has enforceable policies.
- PRs receive a stable impact summary.
- Unit and Playwright result details appear in one report.
- Full and selective execution can be compared in shadow mode.
- Windows and Linux are continuously validated.
- Every fallback is explicit.
- Security audit is clean.
- Documentation includes a working example for every supported workspace.
- At least three real repositories complete a shadow-mode pilot with measured
  fallback and missed-failure rates.

## Features not to build yet

Avoid these until deterministic trust and adoption are proven:

- Autonomous merges.
- AI-only test selection.
- Automatic assertion weakening.
- Silent flaky-test suppression.
- A custom test runner replacing mature frameworks.
- A large hosted UI before result adapters and history are stable.
- Language breadth before TypeScript workspace support is excellent.

## Marketing messages that are safe today

- "Deterministic code-change impact analysis."
- "Scenario coverage connected to real code paths."
- "Selective tests with fail-open full-suite safety."
- "Unit and Playwright tests in one impact plan."
- "Every selected test has an explanation."
- "Human-controlled quality automation."

## Marketing messages to use only after implementation

- "Automatically generates validated tests."
- "Supports every language and monorepo."
- "Predicts regressions with AI."
- "Never misses a test."
- "100% scenario coverage."

Those claims require product evidence, measurable definitions, and independent
validation before publication.
