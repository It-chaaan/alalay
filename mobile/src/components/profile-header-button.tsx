import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { UserCircle } from 'lucide-react-native';

import { authenticatedApiRequest } from '@/services/api';

const palette = {
  surface: '#FFFFFF',
  ink: '#11231C',
  line: '#DCE8E0',
};

export function ProfileHeaderButton() {
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void authenticatedApiRequest<{ avatar_url?: string | null }>('/api/users/me').then((profile) => {
      if (mounted) setProfileAvatar(profile.avatar_url ?? null);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  return <Pressable accessibilityRole="button" accessibilityLabel="Open Settings" style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/settings')}>
    {profileAvatar ? <Image source={profileAvatar} style={styles.image} contentFit="cover" /> : <UserCircle size={27} color={palette.ink} strokeWidth={1.7} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  image: { width: 44, height: 44, borderRadius: 22 },
  pressed: { opacity: 0.72 },
});
