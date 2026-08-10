import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getUnreadNotificationCount } from '@/services/notifications';

const palette = { surface: '#FFFFFF', ink: '#11231C', line: '#DCE8E0' };

export function NotificationHeaderButton() {
  const [unread, setUnread] = useState(() => getUnreadNotificationCount());
  useFocusEffect(useCallback(() => { setUnread(getUnreadNotificationCount()); }, []));

  return <Pressable accessibilityRole="button" accessibilityLabel="Open notifications" style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={() => router.push('/(tabs)/notifications')}>
    <Bell size={21} color={palette.ink} strokeWidth={1.9} />
    {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
