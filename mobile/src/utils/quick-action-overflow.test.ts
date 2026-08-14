import assert from 'node:assert/strict';
import { splitQuickActions } from './quick-action-overflow';

const actions = ['expense', 'income', 'bills', 'subscription', 'goals'].map((id) => ({ id }));

assert.deepEqual(splitQuickActions(actions, 360).visibleActions.map((action) => action.id), actions.map((action) => action.id));
assert.deepEqual(splitQuickActions(actions, 288).visibleActions.map((action) => action.id), ['expense', 'income', 'bills']);
assert.deepEqual(splitQuickActions(actions, 288).overflowActions.map((action) => action.id), ['subscription', 'goals']);
assert.deepEqual(splitQuickActions(actions, 216).visibleActions.map((action) => action.id), ['expense', 'income']);
assert.deepEqual(splitQuickActions(actions, 216).overflowActions.map((action) => action.id), ['bills', 'subscription', 'goals']);

console.log('quick action overflow tests passed');
