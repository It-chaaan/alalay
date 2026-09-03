import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBillListResponse } from './bill-response.js';

test('normalizes both legacy array and occurrence-aware Bills responses', () => {
  const legacy = normalizeBillListResponse([{ id: 'august', title: 'Meralco' } as never]);
  assert.equal(legacy.items.length, 1);
  assert.deepEqual(legacy.overdue_items, []);

  const occurrences = normalizeBillListResponse({ month: '2026-09', items: [], overdue_items: [{ id: 'overdue' } as never] });
  assert.equal(occurrences.month, '2026-09');
  assert.equal(occurrences.overdue_items.length, 1);
});
