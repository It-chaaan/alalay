import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Mail, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, useSettingsStyles } from '@/components/settings-ui';
import { useAppTheme } from '@/theme/theme';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_EFFECTIVE_DATE,
  privacySections,
} from '@shared/privacy-policy';

function openEmail(subject: string) {
  void Linking.openURL(`mailto:${PRIVACY_CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`);
}

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();

  return (
    <SafeAreaView
      style={[s.safe, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <SettingsHeader title="Privacy" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <Shield size={26} color={colors.primary} />
          <Text style={[s.profileName, { color: colors.textPrimary, marginTop: 14 }]}>
            Privacy Policy
          </Text>
          <Text style={[s.muted, { color: colors.textSecondary, marginTop: 6 }]}>
            Effective date: {PRIVACY_EFFECTIVE_DATE}
          </Text>
          <Text style={[s.copy, { color: colors.textSecondary, marginTop: 14 }]}>
            Alalay is a personal-finance management tool, not a bank or professional financial
            adviser. Its insights are informational.
          </Text>
        </View>
        {privacySections.map((section) => (
          <View key={section.title} style={[s.card, { marginTop: 14 }]}>
            <Text style={[s.formLabel, { color: colors.textPrimary }]}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={[s.copy, { color: colors.textSecondary, marginTop: 8 }]}>
                {paragraph}
              </Text>
            ))}
            {section.bullets?.map((bullet) => (
              <Text key={bullet} style={[s.copy, { color: colors.textSecondary, marginTop: 8 }]}>
                • {bullet}
              </Text>
            ))}
          </View>
        ))}
        <View style={[s.card, { marginTop: 14 }]}>
          <Text style={[s.formLabel, { color: colors.textPrimary }]}>
            Contact and deletion requests
          </Text>
          <Text style={[s.copy, { color: colors.textSecondary, marginTop: 8 }]}>
            The app does not yet have automated account deletion. Request deletion by email and do
            not include passwords, codes, tokens, or financial details.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Email Alalay privacy support"
            onPress={() => openEmail('Alalay Privacy or Account Deletion Request')}
            style={({ pressed }) => [
              s.button,
              { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Mail size={17} color={colors.textOnPrimary} />
            <Text style={[s.buttonText, { color: colors.textOnPrimary }]}>
              {PRIVACY_CONTACT_EMAIL}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
