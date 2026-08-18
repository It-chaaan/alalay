import assert from 'node:assert/strict';
import test from 'node:test';
import { createSubscriptionSchema } from './subscription.schema.js';

const validSubscription = {
  name: 'Streaming service',
  category: 'Movies / Streaming',
  amount: 499,
  renewal_date: '2026-09-01',
  billing_cycle: 'monthly' as const,
  auto_renew: true,
  wallet_id: '11111111-1111-4111-8111-111111111111',
};

test('subscriptions require a category label', () => {
  const result = createSubscriptionSchema.safeParse({ ...validSubscription, category: '' });
  assert.equal(result.success, false);
});

test('subscriptions accept canonical category and optional custom category fields', () => {
  const result = createSubscriptionSchema.safeParse({
    ...validSubscription,
    category: 'Other',
    custom_category: 'Professional membership',
  });
  assert.equal(result.success, true);
});
