import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const palette = {
  background: '#F4F7F1',
  surface: '#FFFFFF',
  ink: '#11231C',
  muted: '#5D6C65',
  accent: '#0F8A6B',
  accentPale: '#D8EFE2',
  line: '#DCE8E0',
};

const features = [
  ['Bills', 'Keep due dates and recurring payments in view.'],
  ['Spending', 'See patterns across the choices you make every day.'],
  ['Budget', 'Give every peso a clear and intentional place.'],
  ['Savings', 'Turn a goal into a plan you can keep up with.'],
];

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>ALALAY FEATURES</Text>
        <Text style={styles.title}>A clearer way forward.</Text>
        <Text style={styles.description}>Explore the tools that will help you make money feel easier to understand.</Text>
        <View style={styles.list}>
          {features.map(([title, description]) => (
            <View key={title} style={styles.card}>
              <View style={styles.icon}><Text style={styles.iconText}>{title.slice(0, 1)}</Text></View>
              <View style={styles.copy}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDescription}>{description}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },
  eyebrow: { color: palette.accent, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { marginTop: 10, color: palette.ink, fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  description: { marginTop: 10, color: palette.muted, fontSize: 15, lineHeight: 22 },
  list: { gap: 12, marginTop: 30 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accentPale },
  iconText: { color: palette.accent, fontSize: 17, fontWeight: '800' },
  copy: { flex: 1, marginLeft: 13 },
  cardTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  cardDescription: { marginTop: 3, color: palette.muted, fontSize: 13, lineHeight: 19 },
});
