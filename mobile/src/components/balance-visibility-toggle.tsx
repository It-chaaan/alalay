import { Eye, EyeOff } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

type BalanceVisibilityToggleProps = {
  visible: boolean;
  onToggle: () => void;
  iconColor: string;
  accessibilityLabel?: string;
  positioned?: boolean;
};

export function BalanceVisibilityToggle({
  visible,
  onToggle,
  iconColor,
  accessibilityLabel,
  positioned = false,
}: BalanceVisibilityToggleProps) {
  const Icon = visible ? Eye : EyeOff;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (visible ? 'Hide balances' : 'Show balances')}
      hitSlop={8}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.button,
        positioned && styles.positioned,
        pressed && styles.pressed,
      ]}
    >
      <Icon size={20} color={iconColor} strokeWidth={1.9} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The hit area stays generous while the control itself has no visible surface.
  button: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  positioned: { position: 'absolute', right: 0 },
  pressed: { opacity: 0.68 },
});
