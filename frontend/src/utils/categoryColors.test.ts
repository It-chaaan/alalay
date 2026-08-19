import assert from 'node:assert/strict';
import { getCategoryColor } from './categoryColors';
import { getCategoryMeta } from './categoryRegistry';

assert.equal(getCategoryColor('Food'), getCategoryMeta('Food').color);
assert.equal(getCategoryColor('Utilities'), getCategoryMeta('Utilities').color);
assert.equal(getCategoryColor('Subscriptions'), getCategoryMeta('Subscriptions').color);
assert.equal(getCategoryColor('Uncategorized', 2), getCategoryColor('Uncategorized', 0));
assert.notEqual(getCategoryColor('Healthcare'), getCategoryColor('Food'));
assert.notEqual(getCategoryColor('Transportation'), getCategoryColor('Utilities'));
assert.equal(getCategoryColor('Transportation'), getCategoryColor('Transport'));

console.log('category color mapping tests passed');
