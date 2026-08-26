import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Info, Mail, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SettingsHeader,
  SettingsSection,
  SettingsRow,
  useSettingsStyles,
} from '@/components/settings-ui';
import { useAppTheme } from '@/theme/theme';
import { PRIVACY_CONTACT_EMAIL } from '@shared/privacy-policy';

const capabilities = [
  'Track income, expenses, wallets, bills, and subscriptions.',
  'Plan budgets, savings goals, loans, and financial reports.',
  'Review receipt OCR results before creating an expense.',
  'Use optional AI assistance for informational financial context.',
];

function openEmail(subject: string) {
  void Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`);
}

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();
  const version =
    Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? 'Unknown';
  const year = new Date().getFullYear();

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <SettingsHeader title="About Alalay" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <Info size={26} color={colors.primary} />
          <Text style={[s.profileName, { color: colors.textPrimary, marginTop: 14 }]}>Alalay</Text>
          <Text style={[s.copy, { color: colors.textSecondary, marginTop: 8 }]}>
            A Filipino-first personal-finance management tool for organizing everyday money with
            more clarity.
          </Text>
          <Text style={[s.muted, { color: colors.textSecondary, marginTop: 14 }]}>
            Version {version}
          </Text>
        </View>
        <SettingsSection title="What you can do">
          {capabilities.map((capability, index) => (
            <SettingsRow
              key={capability}
              icon={Shield}
              label={`${index + 1}. ${capability}`}
              value=""
              last={index === capabilities.length - 1}
            />
          ))}
        </SettingsSection>
        <View style={[s.card, { marginTop: 14 }]}>
          <Text style={[s.formLabel, { color: colors.textPrimary }]}>Important note</Text>
          <Text style={[s.copy, { color: colors.textSecondary, marginTop: 8 }]}>
            Alalay is not a bank, lender, investment adviser, tax adviser, legal adviser, or
            professional financial adviser. Its calculations and AI responses are informational and
            should not replace qualified advice.
          </Text>
        </View>
        <SettingsSection title="Privacy and support">
          <SettingsRow
            icon={Shield}
            label="Privacy Policy"
            value="How Alalay handles information"
            onPress={() => router.push('/(tabs)/settings/privacy')}
          />
          <SettingsRow
            icon={Mail}
            label="Contact support"
            value={PRIVACY_CONTACT_EMAIL}
            onPress={() => openEmail('Alalay Support')}
            last
          />
        </SettingsSection>
        <Text
          style={[s.muted, { color: colors.textSecondary, textAlign: 'center', marginTop: 24 }]}
        >
          © {year} Alalay
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => openEmail('Alalay Account Deletion Request')}
          style={({ pressed }) => [
            s.button,
            { backgroundColor: colors.primary, marginTop: 14, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <Mail size={17} color={colors.textOnPrimary} />
          <Text style={[s.buttonText, { color: colors.textOnPrimary }]}>
            Request account deletion
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
