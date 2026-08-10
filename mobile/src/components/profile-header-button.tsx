import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { UserCircle } from 'lucide-react-native';

import { authenticatedApiRequest } from '@/services/api';
import { getUnreadNotificationCount } from '@/services/notifications';

const palette = {
  surface: '#FFFFFF',
  ink: '#11231C',
  line: '#DCE8E0',
};

export function ProfileHeaderButton() {
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(() => getUnreadNotificationCount());

  useEffect(() => {
    let mounted = true;
    void authenticatedApiRequest<{ avatar_url?: string | null }>('/api/users/me').then((profile) => {
      if (mounted) setProfileAvatar(profile.avatar_url ?? null);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    setUnreadNotifications(getUnreadNotificationCount());
  }, []));

  return <Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/profile')}>
    {profileAvatar ? <Image source={profileAvatar} style={styles.image} contentFit="cover" /> : <UserCircle size={27} color={palette.ink} strokeWidth={1.7} />}
    {unreadNotifications > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications}</Text></View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  image: { width: 44, height: 44, borderRadius: 22 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
