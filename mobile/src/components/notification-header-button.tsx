import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getUnreadNotificationCount } from '@/services/notifications';
import { useAppTheme } from '@/theme/theme';

export function NotificationHeaderButton() {
  const { colors } = useAppTheme();
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => { let active = true; void getUnreadNotificationCount().then((count) => { if (active) setUnread(count); }).catch(() => { if (active) setUnread(0); }); return () => { active = false; }; }, []));

  return <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} style={({ pressed }) => [styles.button, { backgroundColor: colors.surfaceTranslucent, borderColor: colors.border }, pressed && styles.pressed]} onPress={() => router.push('/notifications')}>
    <Bell size={21} color={colors.textPrimary} strokeWidth={1.9} />
    {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D92D20' },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
