import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getProfileInitials } from '@/services/profile';

export function ProfileAvatar({ name, url, size, color }: { name: string; url?: string | null; size: number; color: string }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) return <Image source={url} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" cachePolicy="memory-disk" onError={() => setBroken(true)} />;
  return <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}><Text style={[styles.initials, { fontSize: Math.max(12, size * .3) }]}>{getProfileInitials(name)}</Text></View>;
}
const styles = StyleSheet.create({ fallback: { alignItems: 'center', justifyContent: 'center' }, initials: { color: '#fff', fontWeight: '900' } });
