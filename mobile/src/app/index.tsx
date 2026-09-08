import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, FlatList, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLockup } from '@/components/brand-lockup';
import { GoogleSignInButton } from '@/components/google-sign-in-button';

const HERO_ART_WIDTH = 292;
const HERO_ART_HEIGHT = 230;
const PAGINATION_DOT_SIZE = 6;
const PAGINATION_ACTIVE_WIDTH = PAGINATION_DOT_SIZE * 4;


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
  face: string;
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
  line: '#DCE8E0', white: '#FFFFFF', face: '#D99D76',
  bill: '#F7FAF7',
};


type FeatureSlide = {
  key: string;
  label: string;
  source: number;
};

function HeroSlideArt({ source, label }: { source: number; label: string }) {
  return <Image source={source} contentFit="contain" accessibilityLabel={label} style={styles.heroArt} />;
}

const featureSlides: FeatureSlide[] = [
  { key: 'welcome', label: 'Welcome to Alalay', source: require('@/assets/images/onboarding-hero-welcome.svg') as number },
  { key: 'assistant', label: 'Ask Alalay', source: require('@/assets/images/onboarding-hero-assistant.svg') as number },
  { key: 'scanner', label: 'Receipt scanner', source: require('@/assets/images/onboarding-hero-scanner.svg') as number },
  { key: 'budget', label: 'Budget tracking', source: require('@/assets/images/onboarding-hero-budget.svg') as number },
];

function FeatureCarousel({ palette }: { palette: Palette }) {
  const listRef = useRef<FlatList<FeatureSlide>>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedDot, setFocusedDot] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [dotWidths] = useState(() => featureSlides.map((_, index) => new Animated.Value(index === 0 ? PAGINATION_ACTIVE_WIDTH : PAGINATION_DOT_SIZE)));

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (mounted) setIsReducedMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  useEffect(() => {
    dotWidths.forEach((width, index) => Animated.timing(width, { toValue: index === activeIndex ? PAGINATION_ACTIVE_WIDTH : PAGINATION_DOT_SIZE, duration: isReducedMotion ? 0 : 220, useNativeDriver: false }).start());
  }, [activeIndex, dotWidths, isReducedMotion]);

  const resumeAfterIdle = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsInteracting(false), 4500);
  };

  useEffect(() => {
    if (isReducedMotion || isInteracting) return;
    const timer = setInterval(() => {
      const nextIndex = (activeIndex + 1) % featureSlides.length;
      setActiveIndex(nextIndex);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, 2500);
    return () => clearInterval(timer);
  }, [activeIndex, isInteracting, isReducedMotion]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / HERO_ART_WIDTH);
    setActiveIndex(Math.max(0, Math.min(featureSlides.length - 1, nextIndex)));
    resumeAfterIdle();
  };

  const selectSlide = (index: number) => {
    setIsInteracting(true);
    setActiveIndex(index);
    listRef.current?.scrollToIndex({ index, animated: !isReducedMotion });
    resumeAfterIdle();
  };

  return (
    <View style={styles.carousel} accessibilityRole="adjustable" accessibilityLabel={`Feature preview ${activeIndex + 1} of ${featureSlides.length}`}>
      <FlatList
        ref={listRef}
        data={featureSlides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, index) => ({ length: HERO_ART_WIDTH, offset: HERO_ART_WIDTH * index, index })}
        renderItem={({ item }) => <View style={styles.slide}><HeroSlideArt source={item.source} label={item.label} /></View>}
        onTouchStart={() => { setIsInteracting(true); if (resumeTimer.current) clearTimeout(resumeTimer.current); }}
        onScrollBeginDrag={() => setIsInteracting(true)}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      />
      <View style={styles.pagination} accessibilityRole="tablist">
        {featureSlides.map((slide, index) => (
          <Animated.View key={slide.key} style={[styles.dotControl, { width: dotWidths[index] }]}>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={`Show ${slide.label}`}
              accessibilityState={{ selected: index === activeIndex }}
              hitSlop={{ top: 8, right: 10, bottom: 8, left: 10 }}
              onPress={() => selectSlide(index)}
              onFocus={() => setFocusedDot(index)}
              onBlur={() => setFocusedDot(null)}
              style={({ pressed }) => [styles.dotButton, focusedDot === index && { borderColor: palette.accent, borderWidth: 2 }, pressed && styles.dotPressed]}
            >
              <Animated.View style={[styles.dot, { width: '100%', backgroundColor: index === activeIndex ? palette.accent : palette.line }]} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

export default function LandingScreen() {
  const isDark = false;
  const palette = lightPalette;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={['top', 'bottom']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
        <View style={styles.topContent}>
          <BrandLockup color={palette.ink} />

          <View style={styles.copy}>
            <Text style={[styles.title, { color: palette.ink }]}>Pangalagaan ang iyong <Text style={{ color: palette.accent }}>pera.</Text></Text>
            <Text style={[styles.description, { color: palette.muted }]}>A simpler way to track bills, spending, savings, and everything in between.</Text>
          </View>

          <FeatureCarousel palette={palette} />
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin' } })}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, pressed && styles.buttonPressed]}>
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            onPress={() => router.push({ pathname: '/auth', params: { mode: 'create' } })}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: palette.accent, backgroundColor: palette.surface }, pressed && styles.buttonPressed]}>
            <Text style={[styles.secondaryButtonText, { color: palette.accent }]}>Sign Up</Text>
          </Pressable>
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: palette.line }]} />
            <Text style={[styles.orText, { color: palette.muted }]}>or continue with</Text>
            <View style={[styles.orLine, { backgroundColor: palette.line }]} />
          </View>
          <GoogleSignInButton colors={palette} variant="landing" onPress={() => router.push({ pathname: '/auth', params: { mode: 'signin', provider: 'google' } })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 28, paddingTop: 18, paddingBottom: 12 },
  topContent: { alignItems: 'center' },
  copy: { alignItems: 'center', marginTop: 32 },
  title: { maxWidth: 330, fontSize: 31, fontWeight: '800', lineHeight: 37, letterSpacing: -1, textAlign: 'center' },
  description: { maxWidth: 315, marginTop: 14, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  carousel: { width: HERO_ART_WIDTH, height: HERO_ART_HEIGHT + 48, marginTop: 20 },
  slide: { width: HERO_ART_WIDTH, height: HERO_ART_HEIGHT },
  heroArt: { width: HERO_ART_WIDTH, height: HERO_ART_HEIGHT },
  art: { width: HERO_ART_WIDTH, height: HERO_ART_HEIGHT, position: 'relative' },
  slideHeading: { position: 'absolute', left: 34, top: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, zIndex: 4 },
  slideEyebrow: { fontSize: 7, fontWeight: '700' },
  slideTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  previewCard: { position: 'absolute', borderRadius: 11, borderWidth: 1, padding: 11, shadowColor: '#063224', shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
  previewLabel: { fontSize: 8, fontWeight: '700' },
  previewAmount: { marginTop: 7, fontSize: 24, fontWeight: '800', letterSpacing: -0.7 },
  previewSmallAmount: { marginTop: 7, fontSize: 17, fontWeight: '800' },
  previewCaption: { marginTop: 2, fontSize: 8 },
  budgetMainCard: { width: 176, height: 156, left: 38, top: 45 },
  budgetSmallCard: { width: 125, height: 58, left: 139, top: 185 },
  budgetPill: { position: 'absolute', right: 22, top: 51, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, zIndex: 3 },
  budgetPillText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  budgetRow: { marginTop: 7 },
  budgetRowHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetRowLabel: { fontSize: 8 },
  budgetRowValue: { fontSize: 8, fontWeight: '700' },
  budgetTrack: { height: 5, marginTop: 3, borderRadius: 3, overflow: 'hidden' },
  budgetFill: { height: '100%', borderRadius: 3 },
  reportCard: { width: 195, height: 125, left: 28, top: 45 },
  chartArea: { height: 78, marginTop: 8, borderRadius: 9, overflow: 'hidden', justifyContent: 'flex-end', paddingHorizontal: 10, paddingBottom: 8 },
  chartBars: { height: 58, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartBar: { width: 14, borderRadius: 5 },
  chartLine: { position: 'absolute', width: 170, height: 3, borderRadius: 2, right: 5, top: 29, transform: [{ rotate: '-10deg' }] },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  chartLabel: { fontSize: 7 },
  categoryCard: { width: 145, height: 65, left: 130, top: 183 },
  categoryContent: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  categoryDonut: { width: 42, height: 42, borderRadius: 21, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
  categoryTotal: { fontSize: 7, fontWeight: '800' },
  categoryLegend: { marginLeft: 8, gap: 2 },
  legendText: { fontSize: 7 },
  chatCard: { width: 195, height: 125, left: 28, top: 45 },
  userBubble: { alignSelf: 'flex-end', maxWidth: 145, marginTop: 8, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderTopRightRadius: 3 },
  assistantBubble: { maxWidth: 145, marginTop: 7, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, borderTopLeftRadius: 3 },
  bubbleText: { fontSize: 8, lineHeight: 11 },
  assistantBubbleText: { color: '#FFFFFF', fontSize: 8, lineHeight: 11 },
  ocrCard: { width: 155, height: 65, left: 118, top: 183 },
  scanBox: { marginTop: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderStyle: 'dashed' },
  scanText: { fontSize: 9, fontWeight: '700' },
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
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 0 },
  dotControl: { height: 44, justifyContent: 'center' },
  dotButton: { width: '100%', height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotPressed: { opacity: 0.72 },
  dot: { height: PAGINATION_DOT_SIZE, borderRadius: PAGINATION_DOT_SIZE / 2 },
  actions: { width: '100%', paddingTop: 16 },
  primaryButton: { minHeight: 54, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 54, marginTop: 12, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  secondaryButtonText: { fontSize: 15, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 12, fontWeight: '600' },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
