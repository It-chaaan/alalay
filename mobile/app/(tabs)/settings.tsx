import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, CircleDollarSign, Info, LockKeyhole, Moon, Shield } from 'lucide-react-native';
import Constants from 'expo-constants';
import { getSupabaseClient } from '@/services/supabase';
import { authenticatedApiRequest } from '@/services/api';
import { SettingsHeader, SettingsRow, SettingsSection, settingsStyles as s } from '@/components/settings-ui';

type Profile = { name?: string | null; email?: string | null; avatar_url?: string | null; currency?: string | null };

export default function SettingsScreen() {
  const [profile, setProfile] = useState<Profile>({});
  useFocusEffect(useCallback(() => { let active = true; void authenticatedApiRequest<Profile>('/api/settings/me').then((value) => { if (active) setProfile(value); }).catch(() => undefined); return () => { active = false; }; }, []));
  const name = profile.name?.trim() || 'Alalay user';
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const logout = () => Alert.alert('Log out?', 'You’ll need to sign in again to access your account.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: () => { void getSupabaseClient()?.auth.signOut().then(() => router.replace('/auth')); } }]);
  return <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}><SettingsHeader title="Settings" onBack={() => router.back()} /><ScrollView contentContainerStyle={s.content}>
    <View style={s.profile}>{profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initials}>{initials}</Text></View>}<Text style={s.profileName}>{name}</Text><Text numberOfLines={1} style={s.profileEmail}>{profile.email || 'Your account email'}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings/edit-profile' as Href)} style={s.editButton}><Text style={s.editText}>Edit Profile</Text></Pressable></View>
    <SettingsSection title="Preferences"><SettingsRow icon={Moon} label="Appearance" value="Light" onPress={() => router.push('/(tabs)/settings/appearance')} /><SettingsRow icon={CircleDollarSign} label="Currency" value="PHP (₱)" onPress={() => router.push('/(tabs)/settings/currency')} last /></SettingsSection>
    <SettingsSection title="Notifications"><SettingsRow icon={Bell} label="Notifications" value="Bills, spending, budget, savings" onPress={() => router.push('/(tabs)/settings/notifications')} last /></SettingsSection>
    <SettingsSection title="Security"><SettingsRow icon={Shield} label="Security" value="Password and authenticator" onPress={() => router.push('/(tabs)/settings/security')} last /></SettingsSection>
    <SettingsSection title="About"><SettingsRow icon={Info} label="About" value="Privacy and app information" onPress={() => router.push('/(tabs)/settings/about')} /><SettingsRow icon={LockKeyhole} label="Version" value={Constants.expoConfig?.version || '1.0.0'} onPress={() => undefined} last /></SettingsSection>
    <Pressable accessibilityRole="button" onPress={logout} style={s.logout}><Text style={s.logoutText}>Log out</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
