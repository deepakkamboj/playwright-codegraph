import type { ScenarioCoverageReport } from './types.js';

export function scenarioCoverageMarkdown(report: ScenarioCoverageReport): string {
  const lines = [
    '# Scenario Coverage',
    '',
    `Input fingerprint: \`${report.inputFingerprint}\``,
    '',
    '| Scenario | Tests | Declared files | Static links | Runtime observed | Gaps |',
    '|---|---:|---:|---:|---:|---|',
  ];
  for (const entry of report.entries) {
    lines.push(
      `| ${escapeCell(entry.scenarioId)} | ${entry.testFiles.length} | ${entry.resolvedCodePaths.length} | ${entry.staticallyLinkedCodePaths.length} | ${entry.observedRuntimeFiles.length} | ${escapeCell(entry.gaps.join('; '))} |`,
    );
  }
  lines.push('', report.gaps.length ? `**Coverage gate: FAIL (${report.gaps.length} gaps)**` : '**Coverage gate: PASS**', '');
  return lines.join('\n');
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|');
}
