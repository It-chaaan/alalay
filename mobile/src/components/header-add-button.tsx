import { Pressable, StyleSheet, Text } from 'react-native';
import { Plus } from 'lucide-react-native';

import { formPalette } from './finance-form';

export function SectionAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <AddActionButton label={label} onPress={onPress} />;
}

function AddActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Plus size={17} color="#FFFFFF" /><Text style={styles.text}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: formPalette.accent },
  text: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
