import assert from 'node:assert/strict';

import {
  createInsightRequestGate,
  insightPresentation,
  normalizeDashboardInsight,
} from './dashboard-insight';

const fullInsight =
  'You have spent PHP 22,915 out of your PHP 43,652 budget, with PHP 20,737 remaining. Consider setting aside funds for your savings goal.';
assert.equal(normalizeDashboardInsight(fullInsight), fullInsight);
assert.equal(normalizeDashboardInsight('   '), null);
assert.equal(insightPresentation('loading', null), 'loading');
assert.equal(insightPresentation('error', null), 'error');
assert.equal(insightPresentation('empty', null), 'empty');
assert.equal(insightPresentation('ready', fullInsight), 'content');

let calls = 0;
let complete: (() => void) | undefined;
const pending = new Promise<void>((resolve) => {
  complete = resolve;
});
const request = () => {
  calls += 1;
  return pending;
};
const gate = createInsightRequestGate();
assert.equal(gate(request), gate(request));
assert.equal(calls, 1);
complete?.();

console.log('dashboard insight tests passed');
