import assert from 'node:assert/strict';

import { sortCategoriesByLabel, sortGroupedCategories } from './category-sorting';

const entries = [
  { id: 'utilities', label: ' Utilities ' },
  { id: 'food', label: 'food' },
  { id: 'housing', label: 'Housing' },
  { id: 'other', label: 'Other' },
  { id: 'add', label: 'Add category' },
];

const sorted = sortCategoriesByLabel(entries, { isSpecialItem: (item) => item.id === 'add' });
assert.deepEqual(sorted.map((item) => item.label.trim()), ['food', 'Housing', 'Utilities', 'Other', 'Add category']);
assert.deepEqual(entries.map((item) => item.id), ['utilities', 'food', 'housing', 'other', 'add']);
assert.equal(sorted.find((item) => item.label.trim() === 'food')?.id, 'food');
assert.deepEqual(sortCategoriesByLabel([{ id: 'first', label: 'Same' }, { id: 'second', label: ' same ' }]).map((item) => item.id), ['first', 'second']);

const grouped = sortGroupedCategories([
  { group: 'Needs', items: [{ label: 'Utilities' }, { label: 'Food' }] },
  { group: 'Wants', items: [{ label: 'Travel' }, { label: 'Coffee' }] },
]);
assert.deepEqual(grouped.map(({ group }) => group), ['Needs', 'Wants']);
assert.deepEqual(grouped.map(({ items }) => items.map((item) => item.label)), [['Food', 'Utilities'], ['Coffee', 'Travel']]);

assert.deepEqual(sortCategoriesByLabel([{ label: '' }, { label: 'Beta' }, { label: null }]).map((item) => item.label), ['', null, 'Beta']);
const walletTypes = sortCategoriesByLabel(
  [{ value: 'bank', label: 'Bank' }, { value: 'cash', label: 'Cash' }, { value: 'e_wallet', label: 'E-wallet' }],
);
assert.deepEqual(walletTypes.map((item) => item.value), ['bank', 'cash', 'e_wallet']);
console.log('category sorting tests passed');
