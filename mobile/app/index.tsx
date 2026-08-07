import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

type Palette = {
  background: string;
  surface: string;
  card: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentPale: string;
  line: string;
  white: string;
  bill: string;
};

const lightPalette: Palette = {
  background: '#F4F7F1',
  surface: '#FFFFFF',
  card: '#E7F4EB',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentSoft: '#93CFB6',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
  white: '#FFFFFF',
  bill: '#F7FAF7',
};

const darkPalette: Palette = {
  background: '#092018',
  surface: '#102C22',
  card: '#173D2D',
  ink: '#F4FAF6',
  muted: '#B8CAC0',
  accent: '#23A77F',
  accentSoft: '#5DAE8A',
  accentPale: '#1D4C38',
  line: '#295341',
  white: '#F7FCF8',
  bill: '#153326',
};

function BrandLockup({ palette }: { palette: Palette }) {
  return (
    <View accessibilityRole="image" accessibilityLabel="Alalay" style={styles.brand}>
      <Image source={require('@/assets/images/alalay.svg')} style={styles.logo} contentFit="contain" />
      <Text style={[styles.brandName, { color: palette.ink }]}>Alalay</Text>
    </View>
  );
}

function FinanceIllustration({ palette }: { palette: Palette }) {
  const bars = [28, 46, 34, 62, 42];

  return (
    <View accessible accessibilityLabel="A preview of your finances in Alalay" style={styles.art}>
      <View style={[styles.artHalo, { backgroundColor: palette.accentPale }]} />
      <View style={[styles.artOrb, { backgroundColor: palette.accentSoft }]} />

      <View style={[styles.overviewCard, { backgroundColor: palette.accent }]}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewLabel}>Overview</Text>
          <View style={styles.overviewDot} />
        </View>
        <View style={styles.balanceLine} />
        <View style={[styles.balanceLine, styles.balanceLineShort]} />
        <View style={styles.overviewFooter}>
          <View style={styles.miniLine} />
          <View style={[styles.miniLine, styles.miniLineShort]} />
        </View>
      </View>

      <View style={[styles.spendingCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Text style={[styles.metricLabel, { color: palette.muted }]}>Spending</Text>
        <View style={styles.barGroup}>
          {bars.map((height, index) => (
            <View key={height} style={[styles.bar, { height, backgroundColor: index === 3 ? palette.accent : palette.accentSoft }]} />
          ))}
        </View>
      </View>

      <View style={[styles.billsCard, { backgroundColor: palette.bill, borderColor: palette.line }]}>
        <Text style={[styles.metricLabel, { color: palette.ink }]}>Upcoming bills</Text>
        <View style={styles.billRow}>
          <View style={[styles.billChip, { backgroundColor: palette.accent }]} />
          <View style={styles.billCopy}>
            <View style={[styles.billLine, { backgroundColor: palette.line }]} />
            <View style={[styles.billLine, styles.billLineShort, { backgroundColor: palette.line }]} />
          </View>
        </View>
        <View style={styles.billRow}>
          <View style={[styles.billChip, { backgroundColor: palette.accentSoft }]} />
          <View style={styles.billCopy}>
            <View style={[styles.billLine, { backgroundColor: palette.line }]} />
            <View style={[styles.billLine, styles.billLineShort, { backgroundColor: palette.line }]} />
          </View>
        </View>
      </View>

      <View style={[styles.savingsCard, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Text style={[styles.metricLabel, { color: palette.muted }]}>Savings progress</Text>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: palette.accentPale }]}>
            <View style={[styles.progressFill, { backgroundColor: palette.accent }]} />
          </View>
          <Text style={[styles.progressValue, { color: palette.ink }]}>42%</Text>
        </View>
        <View style={[styles.savingsLine, { backgroundColor: palette.line }]} />
      </View>

      <View style={[styles.person, { backgroundColor: palette.accentPale }]}>
        <View style={[styles.personHair, { backgroundColor: palette.ink }]} />
        <View style={[styles.personFace, { backgroundColor: '#D99D76' }]} />
        <View style={[styles.personShirt, { backgroundColor: palette.accent }]} />
      </View>
      <View style={[styles.smallBadge, { backgroundColor: palette.surface, borderColor: palette.line }]}>
        <Text style={[styles.badgeGlyph, { color: palette.accent }]}>₱</Text>
      </View>
    </View>
  );
}

export default function LandingScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? darkPalette : lightPalette;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.topContent}>
          <BrandLockup palette={palette} />

          <View style={styles.copy}>
            <Text style={[styles.title, { color: palette.ink }]}>Your finances, easier to understand and manage.</Text>
            <Text style={[styles.description, { color: palette.muted }]}>Stay on top of your money, bills, spending, budgets, and savings—all in one place.</Text>
          </View>

          <FinanceIllustration palette={palette} />

          <View accessible accessibilityLabel="First of three onboarding screens" style={styles.pagination}>
            <View style={[styles.dot, styles.dotActive, { backgroundColor: palette.accent }]} />
            <View style={[styles.dot, { backgroundColor: palette.line }]} />
            <View style={[styles.dot, { backgroundColor: palette.line }]} />
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'create' } })}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin' } })}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={[styles.secondaryButtonText, { color: palette.muted }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 12 },
  topContent: { alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logo: { width: 30, height: 30 },
  brandName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.7 },
  copy: { alignItems: 'center', marginTop: 32 },
  title: { maxWidth: 338, fontSize: 25, fontWeight: '800', lineHeight: 30, letterSpacing: -0.75, textAlign: 'center' },
  description: { maxWidth: 325, marginTop: 13, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  art: { width: 292, height: 230, marginTop: 20, position: 'relative' },
  artHalo: { position: 'absolute', width: 208, height: 208, borderRadius: 104, left: 35, top: 9 },
  artOrb: { position: 'absolute', width: 17, height: 17, borderRadius: 9, left: 10, top: 91, opacity: 0.75 },
  overviewCard: { position: 'absolute', width: 138, height: 102, borderRadius: 11, left: 29, top: 35, padding: 13, shadowColor: '#063224', shadowOpacity: 0.14, shadowRadius: 12, elevation: 3 },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overviewLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: '600' },
  overviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: 0.75 },
  balanceLine: { width: 70, height: 4, borderRadius: 3, backgroundColor: '#FFFFFF', marginTop: 17, opacity: 0.92 },
  balanceLineShort: { width: 45, marginTop: 6, opacity: 0.56 },
  overviewFooter: { flexDirection: 'row', gap: 5, marginTop: 17 },
  miniLine: { width: 40, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.55 },
  miniLineShort: { width: 25, opacity: 0.32 },
  spendingCard: { position: 'absolute', width: 123, height: 108, borderRadius: 11, left: 151, top: 51, padding: 12, borderWidth: 1, shadowColor: '#063224', shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  metricLabel: { fontSize: 8, fontWeight: '700' },
  barGroup: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 11, paddingHorizontal: 1 },
  bar: { width: 10, borderRadius: 4 },
  billsCard: { position: 'absolute', width: 141, height: 88, borderRadius: 10, left: 15, top: 133, padding: 10, borderWidth: 1, shadowColor: '#063224', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  billRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  billChip: { width: 22, height: 9, borderRadius: 3 },
  billCopy: { marginLeft: 7, gap: 4 },
  billLine: { width: 66, height: 4, borderRadius: 2 },
  billLineShort: { width: 39 },
  savingsCard: { position: 'absolute', width: 142, height: 82, borderRadius: 10, left: 143, top: 146, padding: 10, borderWidth: 1, shadowColor: '#063224', shadowOpacity: 0.07, shadowRadius: 10, elevation: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  progressTrack: { width: 79, height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { width: '42%', height: '100%', borderRadius: 4 },
  progressValue: { marginLeft: 7, fontSize: 11, fontWeight: '800' },
  savingsLine: { width: 82, height: 4, borderRadius: 2, marginTop: 11 },
  person: { position: 'absolute', width: 67, height: 73, borderRadius: 34, left: 94, top: 129, overflow: 'hidden' },
  personHair: { position: 'absolute', width: 31, height: 31, borderRadius: 16, left: 18, top: 11 },
  personFace: { position: 'absolute', width: 26, height: 27, borderRadius: 13, left: 21, top: 18 },
  personShirt: { position: 'absolute', width: 50, height: 36, borderRadius: 22, left: 9, top: 48 },
  smallBadge: { position: 'absolute', width: 32, height: 32, borderRadius: 16, left: 244, top: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badgeGlyph: { fontSize: 15, fontWeight: '800' },
  pagination: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  dotActive: { width: 6, height: 6 },
  actions: { paddingTop: 16 },
  primaryButton: { minHeight: 52, borderRadius: 9, alignItems: 'center', justifyContent: 'center', shadowColor: '#063224', shadowOpacity: 0.12, shadowRadius: 8, elevation: 2 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: { minHeight: 48, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
