import assert from 'node:assert/strict';
import { deriveFinancialStatus } from './financial-status';

const item = (dueDate: string, paid = false) => ({ dueDate, paid });
assert.equal(deriveFinancialStatus(item('2026-08-01', true), '2026-08-14'), 'Paid');
assert.equal(deriveFinancialStatus(item('2026-08-01'), '2026-08-14'), 'Overdue');
assert.equal(deriveFinancialStatus(item('2026-08-14'), '2026-08-14'), 'Due today');
assert.equal(deriveFinancialStatus(item('2026-08-17'), '2026-08-14'), 'Due soon');
assert.equal(deriveFinancialStatus(item('2026-08-18'), '2026-08-14'), 'Upcoming');
console.log('financial status tests passed');
