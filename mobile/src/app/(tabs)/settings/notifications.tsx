import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { authenticatedApiRequest } from '@/services/api';
import { reconcileFinancialReminders } from '@/services/financial-reminders';
import { SettingsHeader, useSettingsStyles } from '@/components/settings-ui';
import { useBottomNavClearance } from '@/components/bottom-nav-clearance';
import { useAppTheme } from '@/theme/theme';

type Preferences = {
  bill_reminders: boolean;
  bill_reminder_days: number;
  bill_reminder_three_days: boolean;
  bill_reminder_one_day: boolean;
  bill_reminder_due_day: boolean;
  bill_overdue_reminders: boolean;
  bill_reminder_hour: number;
  bill_reminder_minute: number;
  subscription_reminders: boolean;
  subscription_reminder_three_days: boolean;
  subscription_reminder_one_day: boolean;
  subscription_reminder_due_day: boolean;
  subscription_overdue_reminders: boolean;
  summaries: boolean;
  overspending_alerts: boolean;
  budget_thresholds: boolean;
  savings_milestones: boolean;
  login_alerts: boolean;
};
const defaults: Preferences = {
  bill_reminders: true,
  bill_reminder_days: 3,
  bill_reminder_three_days: true,
  bill_reminder_one_day: true,
  bill_reminder_due_day: true,
  bill_overdue_reminders: true,
  bill_reminder_hour: 9,
  bill_reminder_minute: 0,
  subscription_reminders: true,
  subscription_reminder_three_days: true,
  subscription_reminder_one_day: true,
  subscription_reminder_due_day: true,
  subscription_overdue_reminders: true,
  summaries: false,
  overspending_alerts: true,
  budget_thresholds: true,
  savings_milestones: true,
  login_alerts: true,
};
const groups = [
  {
    title: 'Finances',
    rows: [
      {
        key: 'bill_reminders',
        label: 'Bill due reminders',
        copy: 'Get reminded before bills are due.',
      },
      {
        key: 'bill_reminder_three_days',
        label: '3 days before',
        copy: 'Remind me three days before a bill is due.',
      },
      {
        key: 'bill_reminder_one_day',
        label: '1 day before',
        copy: 'Remind me the day before a bill is due.',
      },
      {
        key: 'bill_reminder_due_day',
        label: 'On the due date',
        copy: 'Remind me on the due date at 9:00 AM.',
      },
      {
        key: 'bill_overdue_reminders',
        label: 'Overdue reminders',
        copy: 'Send one restrained reminder after a bill becomes overdue.',
      },
      {
        key: 'overspending_alerts',
        label: 'Low balance / overspending alerts',
        copy: 'Get notified when balances are low or spending is unusually high.',
      },
      {
        key: 'budget_thresholds',
        label: 'Budget threshold reached',
        copy: "Get notified when you're approaching or reaching your budget limit.",
      },
    ],
  },
  {
    title: 'Recurring & goals',
    rows: [
      {
        key: 'subscription_reminders',
        label: 'Subscription renewal reminders',
        copy: 'Get reminded before active subscriptions renew.',
      },
      {
        key: 'subscription_reminder_three_days',
        label: '3 days before renewal',
        copy: 'Remind me three days before a subscription renews.',
      },
      {
        key: 'subscription_reminder_one_day',
        label: '1 day before renewal',
        copy: 'Remind me the day before a subscription renews.',
      },
      {
        key: 'subscription_reminder_due_day',
        label: 'On renewal date',
        copy: 'Remind me on the renewal date at 9:00 AM.',
      },
      {
        key: 'subscription_overdue_reminders',
        label: 'Missed renewal recovery',
        copy: 'Recover a missed renewal reminder for up to seven days.',
      },
      {
        key: 'savings_milestones',
        label: 'Savings goal milestones',
        copy: 'Celebrate progress when you reach savings milestones.',
      },
    ],
  },
  {
    title: 'Security',
    rows: [
      {
        key: 'login_alerts',
        label: 'New device login alerts',
        copy: 'Get notified when your account is accessed from a new device.',
      },
    ],
  },
];

export default function NotificationSettingsScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();
  const bottomNavClearance = useBottomNavClearance();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Set<keyof Preferences>>(new Set());
  const preferencesRef = useRef<Preferences | null>(null);
  const sequence = useRef<Record<string, number>>({});
  useEffect(() => {
    void authenticatedApiRequest<Preferences>('/api/users/me/notification-preferences')
      .then((value) => {
        const next = { ...defaults, ...value };
        preferencesRef.current = next;
        setPreferences(next);
      })
      .catch(() => setError('Notification preferences could not load.'))
      .finally(() => setLoading(false));
  }, []);
  const toggle = async (key: keyof Preferences) => {
    if (
      key === 'bill_reminder_days' ||
      key === 'bill_reminder_hour' ||
      key === 'bill_reminder_minute' ||
      key === 'summaries' ||
      !preferencesRef.current
    )
      return;
    const before = preferencesRef.current[key] as boolean;
    const requestId = (sequence.current[key] || 0) + 1;
    sequence.current[key] = requestId;
    const optimistic = { ...preferencesRef.current, [key]: !before } as Preferences;
    preferencesRef.current = optimistic;
    setPreferences(optimistic);
    setSaving((current) => new Set(current).add(key));
    setError('');
    try {
      const authoritative = await authenticatedApiRequest<Preferences>(
        '/api/users/me/notification-preferences',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [key]: !before }),
        },
      );
      if (sequence.current[key] === requestId) {
        const next = {
          ...(preferencesRef.current || defaults),
          [key]: authoritative[key],
        } as Preferences;
        preferencesRef.current = next;
        setPreferences(next);
        if (key.startsWith('bill_') || key.startsWith('subscription_'))
          void reconcileFinancialReminders();
      }
    } catch {
      if (sequence.current[key] === requestId) {
        const next = { ...(preferencesRef.current || defaults), [key]: before } as Preferences;
        preferencesRef.current = next;
        setPreferences(next);
        setError('Notification preference could not be saved. Your previous setting was restored.');
      }
    } finally {
      setSaving((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };
  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <SettingsHeader title="Notification Settings" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomNavClearance + 24 }]}>
        <View style={s.card}>
          <Bell size={24} color={colors.primary} />
          <Text style={[s.profileName, { marginTop: 10, fontSize: 18 }]}>
            Notification preferences
          </Text>
          <Text style={[s.copy, { marginTop: 5 }]}>
            Bill and subscription settings control inbox reminders and local device reminders. Other
            saved categories are not yet delivered by a server push service.
          </Text>
        </View>
        {loading || !preferences ? (
          <View style={s.card}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.title} style={s.subGroup}>
              <Text style={s.sectionLabel}>{group.title}</Text>
              <View style={s.group}>
                {group.rows.map((row, index) => (
                  <View
                    key={row.key}
                    style={[s.toggleRow, index === group.rows.length - 1 && s.rowLast]}
                  >
                    <View style={s.toggleCopy}>
                      <Text style={s.rowLabel}>{row.label}</Text>
                      <Text style={s.rowValue}>{row.copy}</Text>
                    </View>
                    <View style={s.switchSlot}>
                      <Switch
                        accessibilityLabel={row.label}
                        accessibilityRole="switch"
                        value={Boolean(preferences[row.key as keyof Preferences])}
                        onValueChange={() => void toggle(row.key as keyof Preferences)}
                        disabled={saving.has(row.key as keyof Preferences)}
                        trackColor={{ false: colors.surfaceSecondary, true: colors.primarySoft }}
                        thumbColor={
                          preferences[row.key as keyof Preferences]
                            ? colors.primary
                            : colors.textMuted
                        }
                        style={s.switch}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
