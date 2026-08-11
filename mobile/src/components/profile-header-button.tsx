import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { UserCircle } from 'lucide-react-native';

import { useCurrentProfile } from '@/hooks/use-current-profile';
import { getProfileInitials } from '@/services/profile';
import { useAppTheme } from '@/theme/theme';

export function ProfileHeaderButton() {
  const { colors } = useAppTheme();
  const { profile } = useCurrentProfile();

  return <Pressable accessibilityRole="button" accessibilityLabel="Open Settings" style={({ pressed }) => [styles.button, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/settings')}>
    {profile?.avatarUrl ? <Image source={profile.avatarUrl} style={styles.image} contentFit="cover" /> : profile ? <ViewAvatar initials={getProfileInitials(profile.name)} color={colors.primary} /> : <UserCircle size={27} color={colors.textPrimary} strokeWidth={1.7} />}
  </Pressable>;
}

function ViewAvatar({ initials, color }: { initials: string; color: string }) { return <View style={[styles.initials, { backgroundColor: color }]}><Text style={styles.initialsText}>{initials}</Text></View>; }

const styles = StyleSheet.create({
  button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  image: { width: 44, height: 44, borderRadius: 22 }, initials: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F8A6B' }, initialsText: { color: '#FFFFFF', fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
