import assert from 'node:assert/strict';
import { ApiRequestError } from '../lib/apiClient';
import { parseBillListResponse } from './useBills';

const bill = {
  id: 'occurrence-1',
  title: 'Internet',
  amount: 1500,
  category: 'Utilities',
  due_date: '2026-09-10',
  recurring: true,
  frequency: 'monthly',
  status: 'due_soon' as const,
  paid_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

assert.deepEqual(parseBillListResponse({ month: '2026-09', items: [bill], overdue_items: [], overview: {} }), [bill]);
assert.deepEqual(parseBillListResponse({ month: '2026-09', items: [bill], overdue_items: [bill], overview: {} }), [bill]);
assert.deepEqual(parseBillListResponse({ month: '2026-09', items: [], overdue_items: [], overview: {} }), []);
assert.throws(
  () => parseBillListResponse({ bills: [bill] }),
  (error: unknown) => error instanceof ApiRequestError && error.code === 'invalid_response',
);

console.log('bill list response contract tests passed');
