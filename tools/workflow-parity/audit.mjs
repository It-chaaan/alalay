import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criticalEvidence, financialContracts, workflows } from './manifest.mjs';

const root = resolve(import.meta.dirname, '../..');
const check = process.argv.includes('--check');
const evaluated = workflows.map(([id, feature, status, severity, evidence]) => {
  const missingEvidence = evidence.filter((path) => !existsSync(resolve(root, path)));
  const missingMarkers = (criticalEvidence[id] ?? []).filter(([path, marker]) => {
    const evidencePath = resolve(root, path);
    return !existsSync(evidencePath) || !readFileSync(evidencePath, 'utf8').includes(marker);
  });
  return {
    id,
    feature,
    status: missingEvidence.length || missingMarkers.length ? 'MANUAL_REVIEW' : status,
    severity,
    evidence,
    missingEvidence,
    missingMarkers,
    notes:
      missingEvidence.length || missingMarkers.length
        ? 'One or more evidence references or required source markers no longer resolve.'
        : undefined,
  };
});
const counts = Object.fromEntries(
  ['PARITY', 'PARTIAL', 'MISSING', 'DIFFERENT', 'MANUAL_REVIEW'].map((status) => [
    status,
    evaluated.filter((item) => item.status === status).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  statusModel: Object.keys(counts),
  workflows: evaluated,
  financialContracts,
};
const reportDirectory = resolve(root, 'docs');
mkdirSync(reportDirectory, { recursive: true });
writeFileSync(
  resolve(reportDirectory, 'workflow-parity-report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
const lines = [
  '# Mobile → Web Workflow Parity Report',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  '## Summary',
  '',
  ...Object.entries(counts).map(([status, count]) => `- ${status}: ${count}`),
  '',
];
for (const feature of [...new Set(evaluated.map((item) => item.feature))]) {
  lines.push(`## ${feature}`, '');
  for (const item of evaluated.filter((candidate) => candidate.feature === feature))
    lines.push(
      `### ${item.id}`,
      `- Status: ${item.status}`,
      `- Severity: ${item.severity}`,
      `- Evidence: ${item.evidence.map((path) => `\`${path}\``).join(', ')}`,
      item.missingEvidence.length ? `- Missing evidence: ${item.missingEvidence.join(', ')}` : '',
      item.missingMarkers.length
        ? `- Missing source markers: ${item.missingMarkers.map(([path, marker]) => `${path}: ${marker}`).join(', ')}`
        : '',
      '',
    );
}
lines.push(
  '## Financial contracts',
  '',
  ...financialContracts.map(
    ([id, note, evidence]) => `- **${id}** — ${note} Evidence: \`${evidence}\`.`,
  ),
  '',
);
writeFileSync(
  resolve(reportDirectory, 'workflow-parity-report.md'),
  lines.filter(Boolean).join('\n'),
);
console.log(
  `Workflow parity report generated: ${counts.PARITY} parity, ${counts.PARTIAL} partial, ${counts.MANUAL_REVIEW} manual review.`,
);
if (
  check &&
  evaluated.some(
    (item) =>
      (item.status === 'MISSING' || item.status === 'DIFFERENT') &&
      ['P0', 'P1'].includes(item.severity),
  )
)
  process.exitCode = 1;
