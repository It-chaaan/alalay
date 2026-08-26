import assert from 'node:assert/strict';
import { evaluateAmountExpression } from './amount-calculator';

assert.equal(evaluateAmountExpression('100+50*2').value, 200);
assert.equal(evaluateAmountExpression('1000/4+50').value, 300);
assert.equal(evaluateAmountExpression('0.1+0.2').value, 0.3);
assert.equal(evaluateAmountExpression('10-20').value, -10);
assert.equal(evaluateAmountExpression('10/0').error, 'Cannot divide by zero.');
assert.equal(evaluateAmountExpression('10+').error, 'Complete the calculation before continuing.');
assert.equal(evaluateAmountExpression('1.2.3').error, 'Complete the calculation before continuing.');

console.log('amount calculator tests passed');
