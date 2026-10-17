# Rush two-package example

This is an independently runnable TypeScript repository that demonstrates the
complete `playwright-codegraph` workflow with two Rush projects:

```text
@demo/store-app  --->  @demo/math-core
```

- `@demo/math-core` contains reusable pricing logic and unit tests.
- `@demo/store-app` depends on `@demo/math-core` and contains an HTTP server,
  unit tests, and a Playwright customer-journey test.
- `test-scenarios.yml` maps customer and user journeys to both code paths and
  `@scenario` test annotations.
- The demo covers happy-path, positive, negative, edge, and corner scenarios,
  including explicit dependency arrows in the journey workflow.

The root uses npm workspaces for a one-command demo installation. `rush.json`
remains the authoritative project graph consumed by `playwright-codegraph`.

## Run the example

When running the example from this source repository, first build the local
package from the repository root:

```bash
npm install
npm run build
```

Then, from this example directory:

```bash
npm install
npm run build
npm run test:all
```

Create a local Git baseline because affected-test selection requires history:

```bash
git init -b main
git config user.email "demo@example.com"
git config user.name "Demo User"
git add .
git commit -m "baseline"
```

Build and validate the graph:

```bash
npm run graph:build
npm run doctor
npm run scenarios
```

Change `packages/math-core/src/index.ts`, then create and execute the
deterministic affected-test plan:

```bash
npm run plan
npm run explain:math
npm run run:selected
npm run report
```

Because `@demo/store-app` depends on `@demo/math-core`, a math-core change
selects the core unit test through codegraph and the store-app unit test through
the Rush dependent-project safety policy. The checkout Playwright test is also
linked through the journey/scenario model.

Open `test-selection-out/codegraph-report.html` to inspect the unified PR
impact, changed-code graph, scenario dependency workflow, taxonomy coverage,
execution, and safety dashboard.

## Using the published package

Within this source repository, `playwright-codegraph` is installed through
`file:../..` so the example tests the current implementation. After copying the
example elsewhere, replace that dependency with the desired published version.
