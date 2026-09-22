import assert from 'node:assert/strict';
import { matchesWalletPreset, walletPresets } from './wallets';

const find = (query: string) =>
  walletPresets.filter((preset) => matchesWalletPreset(preset, query)).map((preset) => preset.key);

assert.ok(find('AUB').includes('aub'));
assert.ok(find('Development Bank of the Philippines').includes('dbp'));
assert.ok(find('SeaBank').includes('maribank'));
assert.ok(find('PayMaya').includes('maya'));
assert.ok(find('Maya Bank').includes('maya_bank'));
assert.equal(new Set(walletPresets.map((preset) => preset.key)).size, walletPresets.length);
assert.equal(walletPresets.find((preset) => preset.key === 'gcash')?.group, 'E-wallets');
assert.equal(
  walletPresets.find((preset) => preset.key === 'maya_bank')?.group,
  'Digital and app-based banks',
);
assert.ok(walletPresets.some((preset) => preset.key === 'cash'));
console.log('wallet preset search tests passed');
