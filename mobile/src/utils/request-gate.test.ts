import assert from 'node:assert/strict';

import { createLatestRequestGuard, createRequestGate } from './request-gate';

void (async () => {
  let calls = 0;
  let resolveRequest: ((value: number) => void) | undefined;
  const pending = new Promise<number>((resolve) => {
    resolveRequest = resolve;
  });
  const gate = createRequestGate<number>();
  const first = gate(() => {
    calls += 1;
    return pending;
  });
  const second = gate(() => {
    calls += 1;
    return Promise.resolve(2);
  });
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolveRequest?.(1);
  await first;
  assert.equal(
    await gate(async () => {
      calls += 1;
      return 3;
    }),
    3,
  );
  assert.equal(calls, 2);

  const latest = createLatestRequestGuard();
  const firstGeneration = latest.begin();
  const secondGeneration = latest.begin();
  assert.equal(latest.isCurrent(firstGeneration), false);
  assert.equal(latest.isCurrent(secondGeneration), true);
  latest.invalidate();
  assert.equal(latest.isCurrent(secondGeneration), false);

  console.log('request gate tests passed');
})();
