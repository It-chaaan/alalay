import assert from 'node:assert/strict';
import { resolveBrand } from './brand-resolver';

for (const [key, name] of [['cash', 'Cash'], ['bdo', 'BDO'], ['gcash', 'GCash'], ['maya', 'Maya']] as const) {
  const brand = resolveBrand(name, 'wallet', key);
  assert.ok(brand, `${name} should resolve a wallet mark`);
  assert.ok(brand.mark.length > 0, `${name} should have a visible mark`);
}

assert.equal(resolveBrand('Unknown institution', 'wallet', 'unknown'), null);
console.log('wallet brand resolver tests passed');
