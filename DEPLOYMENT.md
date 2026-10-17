# Deployment models

Playwright CodeGraph keeps source analysis, graph construction, test selection,
and test execution inside the customer environment in every deployment model.
The models differ only in where policy, history, and report metadata are
managed.

## Models

| Model | Execution and source | Control plane | Published data |
| --- | --- | --- | --- |
| Cloud | Customer workstation or CI runner | Vendor-managed SaaS | Redacted report or metadata, by policy |
| Hybrid | Customer workstation or CI runner | Private endpoint or customer-managed gateway | Metadata-only by default |
| On-prem | Customer workstation or CI runner | None required | Local artifacts only |

The deployment contract is
[`deployment-profile.schema.json`](./deployment-profile.schema.json). Example
profiles are under [`examples/deployment`](./examples/deployment).

## Security boundaries

1. Repository source and authenticated browser state remain in the customer
   execution boundary.
2. The deterministic selector makes all skip/run decisions locally.
3. Cloud services can store policy, aggregate metrics, and explicitly allowed
   artifacts, but cannot silently broaden their data access.
4. Hybrid connectivity uses private networking and workload identity or mutual
   TLS.
5. On-prem mode requires no network access and produces the same standalone
   HTML report.
6. Artifact publication is explicit: `local-only`, `metadata-only`, or
   `full-report`. Path redaction is independently controlled.

## Operating workflow

The execution workflow is identical for every model:

```bash
npx playwright-codegraph graph sync
npx playwright-codegraph scenarios
npx playwright-codegraph plan --base origin/main
npx playwright-codegraph run
npx playwright-codegraph report
```

- **Cloud:** CI may publish the allowed report payload to the configured
  control-plane endpoint after local execution.
- **Hybrid:** CI publishes only allowed metadata through a private endpoint;
  full reports remain in customer artifact storage.
- **On-prem:** CI stores `test-selection-out` in the customer's existing
  artifact system. No control plane is contacted.

The current package implements the local/CI deterministic data plane and the
portable report. The schema defines the stable boundary for future control
plane integrations; it does not cause this package to upload data.

## Customer demo

Use [`examples/rush-two-package`](./examples/rush-two-package) to demonstrate:

- Happy-path, positive, negative, edge, and corner scenarios.
- Explicit scenario dependencies and ordered user-journey workflows.
- Changed-code to scenario to test impact graphs.
- Unit and Playwright selection in one deterministic plan.
- A standalone report that works in cloud, hybrid, or disconnected on-prem
  environments.
