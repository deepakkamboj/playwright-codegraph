import type { CodegraphSelectionConfig } from './config.js';
import { executePlan, type ExecutionResult } from './executor.js';
import type { SelectionPlan } from './types.js';

export interface ShadowResult {
  readonly inputFingerprint: string;
  readonly selective: ExecutionResult;
  readonly full: ExecutionResult;
  readonly missedFailure: boolean;
}

export async function executeShadow(
  plan: SelectionPlan,
  config: CodegraphSelectionConfig,
): Promise<ShadowResult> {
  const selective = await executePlan(plan, config);
  const fullPlan: SelectionPlan = {
    ...plan,
    mode: 'full',
    tests: plan.tests.map((test) => ({
      ...test,
      reasons: [...test.reasons, { code: 'full-fallback', detail: 'shadow authoritative full execution' }],
    })),
  };
  const full = plan.mode === 'full' ? selective : await executePlan(fullPlan, config);
  return {
    inputFingerprint: plan.inputFingerprint,
    selective,
    full,
    missedFailure: selective.exitCode === 0 && full.exitCode !== 0,
  };
}
