import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { getServiceSupabase } from '../config/supabase.js';
import { createServer } from './server.js';
import { syncSubscriptionReminders } from './subscription-reminders.service.js';

const localSupabaseUrl =
  env.SUPABASE_URL && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/u.test(env.SUPABASE_URL)
    ? env.SUPABASE_URL
    : null;
const canRunIntegration = Boolean(
  localSupabaseUrl && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY,
);
const schedulerSecret = 'billing-scheduler-test-secret';

function todayInManila() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function schedulerRequest(
  baseUrl: string,
  secret?: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}/internal/scheduler/billing`, {
    method: 'POST',
    headers: secret ? { 'x-scheduler-secret': secret } : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test('billing scheduler rejects missing and incorrect secrets before running the job', async () => {
  let runCount = 0;
  const app = createServer({
    schedulerSecret,
    schedulerJobRunner: async () => {
      runCount += 1;
      return { subscriptionsProcessed: { processed: 0 } };
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const missingSecret = await schedulerRequest(baseUrl);
    assert.equal(missingSecret.status, 401);
    assert.deepEqual(missingSecret.body, {
      success: false,
      error: { code: 'unauthorized', message: 'Scheduler authentication failed.' },
    });

    const incorrectSecret = await schedulerRequest(baseUrl, `${schedulerSecret}-incorrect`);
    assert.equal(incorrectSecret.status, 401);
    assert.equal(runCount, 0);

    const accepted = await schedulerRequest(baseUrl, schedulerSecret);
    assert.equal(accepted.status, 200);
    assert.equal(runCount, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test(
  'billing scheduler authenticates, processes all owners, and remains idempotent',
  { skip: canRunIntegration ? false : 'local Supabase credentials are unavailable' },
  async () => {
    assert.ok(localSupabaseUrl);
    assert.ok(env.SUPABASE_ANON_KEY);
    const admin = getServiceSupabase();
    const app = createServer({ schedulerSecret });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const today = todayInManila();
    const password = `Billing-${randomUUID()}!`;
    const fixtures = [
      {
        userId: randomUUID(),
        walletId: randomUUID(),
        subscriptionId: randomUUID(),
        email: `billing-a-${randomUUID()}@example.test`,
        name: 'Scheduler Owner A',
      },
      {
        userId: randomUUID(),
        walletId: randomUUID(),
        subscriptionId: randomUUID(),
        email: `billing-b-${randomUUID()}@example.test`,
        name: 'Scheduler Owner B',
      },
    ];

    try {
      for (const fixture of fixtures) {
        const created = await admin.auth.admin.createUser({
          id: fixture.userId,
          email: fixture.email,
          password,
          email_confirm: true,
          user_metadata: { name: fixture.name },
        });
        assert.ifError(created.error);
      }

      const wallets = await admin.from('wallets').insert(
        fixtures.map((fixture, index) => ({
          id: fixture.walletId,
          user_id: fixture.userId,
          name: `Scheduler Wallet ${index + 1}`,
          institution_type: 'bank',
          institution_key: `scheduler-bank-${index + 1}`,
          account_type: 'debit',
        })),
      );
      assert.ifError(wallets.error);

      const subscriptions = await admin.from('subscriptions').insert(
        fixtures.map((fixture, index) => ({
          id: fixture.subscriptionId,
          user_id: fixture.userId,
          wallet_id: fixture.walletId,
          name: `Scheduler Subscription ${index + 1}`,
          amount: 100 + index,
          renewal_date: today,
          billing_cycle: 'monthly',
          auto_renew: true,
        })),
      );
      assert.ifError(subscriptions.error);

      const missingSecret = await schedulerRequest(baseUrl);
      assert.equal(missingSecret.status, 401);
      assert.deepEqual(missingSecret.body, {
        success: false,
        error: { code: 'unauthorized', message: 'Scheduler authentication failed.' },
      });

      const incorrectSecret = await schedulerRequest(baseUrl, `${schedulerSecret}-incorrect`);
      assert.equal(incorrectSecret.status, 401);

      const firstRun = await schedulerRequest(baseUrl, schedulerSecret);
      assert.equal(firstRun.status, 200);

      const firstOccurrences = await admin
        .from('subscription_occurrences')
        .select('id, subscription_id, generated_expense_id')
        .in(
          'subscription_id',
          fixtures.map((fixture) => fixture.subscriptionId),
        );
      assert.ifError(firstOccurrences.error);
      assert.equal(firstOccurrences.data?.length, 2);
      assert.equal(
        firstOccurrences.data?.every((occurrence) => occurrence.generated_expense_id),
        true,
      );

      for (const fixture of fixtures) {
        await syncSubscriptionReminders(fixture.userId);
        await syncSubscriptionReminders(fixture.userId);
      }

      const secondRun = await schedulerRequest(baseUrl, schedulerSecret);
      assert.equal(secondRun.status, 200);

      const afterRerun = await Promise.all([
        admin
          .from('subscription_occurrences')
          .select('id', { count: 'exact', head: true })
          .in(
            'subscription_id',
            fixtures.map((fixture) => fixture.subscriptionId),
          ),
        admin
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .in(
            'subscription_id',
            fixtures.map((fixture) => fixture.subscriptionId),
          )
          .eq('generated_by', 'subscription')
          .is('deleted_at', null),
        admin
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .in(
            'related_subscription_id',
            fixtures.map((fixture) => fixture.subscriptionId),
          )
          .eq('source_type', 'subscription_occurrence'),
      ]);
      afterRerun.forEach((result) => assert.ifError(result.error));
      assert.deepEqual(
        afterRerun.map((result) => result.count),
        [2, 2, 2],
      );

      const anonymous = createClient(localSupabaseUrl, env.SUPABASE_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const anonymousCall = await anonymous.rpc('process_subscription_billing_occurrences', {
        target_user_id: null,
        target_through: today,
      });
      assert.ok(anonymousCall.error);

      const sessions = await Promise.all(
        fixtures.map(async (fixture) => {
          const userClient = createClient(localSupabaseUrl, env.SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const signedIn = await userClient.auth.signInWithPassword({
            email: fixture.email,
            password,
          });
          assert.ifError(signedIn.error);
          return userClient;
        }),
      );

      const crossUserCall = await sessions[0].rpc('process_subscription_billing_occurrences', {
        target_user_id: fixtures[1].userId,
        target_through: today,
      });
      assert.ok(crossUserCall.error);

      const userScopedSubscriptionId = randomUUID();
      const userScopedInsert = await admin.from('subscriptions').insert({
        id: userScopedSubscriptionId,
        user_id: fixtures[0].userId,
        wallet_id: fixtures[0].walletId,
        name: 'User-scoped Subscription',
        amount: 303,
        renewal_date: today,
        billing_cycle: 'monthly',
        auto_renew: true,
      });
      assert.ifError(userScopedInsert.error);
      const userScopedCall = await sessions[0].rpc('process_subscription_billing_occurrences', {
        target_user_id: null,
        target_through: today,
      });
      assert.ifError(userScopedCall.error);
      const userScopedOccurrence = await admin
        .from('subscription_occurrences')
        .select('id')
        .eq('subscription_id', userScopedSubscriptionId)
        .single();
      assert.ifError(userScopedOccurrence.error);

      const concurrentSubscriptionIds = fixtures.map(() => randomUUID());
      const concurrentInsert = await admin.from('subscriptions').insert(
        fixtures.map((fixture, index) => ({
          id: concurrentSubscriptionIds[index],
          user_id: fixture.userId,
          wallet_id: fixture.walletId,
          name: `Concurrent Subscription ${index + 1}`,
          amount: 400 + index,
          renewal_date: today,
          billing_cycle: 'monthly',
          auto_renew: true,
        })),
      );
      assert.ifError(concurrentInsert.error);

      const concurrentRuns = await Promise.all([
        schedulerRequest(baseUrl, schedulerSecret),
        schedulerRequest(baseUrl, schedulerSecret),
      ]);
      assert.equal(
        concurrentRuns.every((result) => result.status === 200),
        true,
      );

      const concurrentCounts = await Promise.all([
        admin
          .from('subscription_occurrences')
          .select('id', { count: 'exact', head: true })
          .in('subscription_id', concurrentSubscriptionIds),
        admin
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .in('subscription_id', concurrentSubscriptionIds)
          .eq('generated_by', 'subscription')
          .is('deleted_at', null),
      ]);
      concurrentCounts.forEach((result) => assert.ifError(result.error));
      assert.deepEqual(
        concurrentCounts.map((result) => result.count),
        [2, 2],
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      for (const fixture of fixtures) {
        await admin.auth.admin.deleteUser(fixture.userId);
      }
    }
  },
);
