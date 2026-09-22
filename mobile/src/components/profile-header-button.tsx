import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { UserCircle } from 'lucide-react-native';

import { useCurrentProfile } from '@/hooks/use-current-profile';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useAppTheme } from '@/theme/theme';

export function ProfileHeaderButton() {
  const { colors } = useAppTheme();
  const { profile } = useCurrentProfile();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Settings"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
      onPress={() => router.push('/(tabs)/settings')}
    >
      {profile ? (
        <ProfileAvatar
          name={profile.name}
          url={profile.avatarUrl}
          size={44}
          color={colors.primary}
        />
      ) : (
        <UserCircle size={27} color={colors.textPrimary} strokeWidth={1.7} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  pressed: { opacity: 0.72 },
});
