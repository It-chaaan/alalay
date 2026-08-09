import { Pressable, StyleSheet, Text } from 'react-native';
import { Plus } from 'lucide-react-native';

import { formPalette } from './finance-form';

export function HeaderAddButton({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Plus size={18} color="#FFFFFF" /><Text style={styles.text}>Add</Text></Pressable>;
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: formPalette.accent },
  text: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
