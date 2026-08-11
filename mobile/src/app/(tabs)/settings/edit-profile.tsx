import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, settingsStyles as s } from '@/components/settings-ui';
import { useCurrentProfile } from '@/hooks/use-current-profile';
import { getProfileInitials, updateCurrentProfile } from '@/services/profile';
import { useAppTheme } from '@/theme/theme';

export default function EditProfileScreen() {
  const { colors } = useAppTheme();
  const { profile, loading, error: loadError, retry } = useCurrentProfile();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const initializedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (profile && initializedUserId.current !== profile.userId) {
      initializedUserId.current = profile.userId;
      setName(profile.name);
      setPhone(profile.phone);
    }
  }, [profile]);

  const dirty = Boolean(profile && (name !== profile.name || phone !== profile.phone));
  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { setSaveError('Name is required.'); return; }
    if (trimmedName.length > 200) { setSaveError('Name is too long.'); return; }
    if (saving || !profile) return;
    setSaving(true); setSaveError(''); setSaved(false);
    try {
      await updateCurrentProfile({ name: trimmedName, phone: phone.trim() || null });
      setSaved(true);
      setTimeout(() => router.back(), 500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save your profile.');
    } finally { setSaving(false); }
  };

  const providerCopy = profile?.avatarSource === 'profile'
    ? 'Your current profile photo is saved to your profile.'
    : profile?.avatarSource === 'provider'
      ? `${profile.provider ? `${profile.provider[0].toUpperCase()}${profile.provider.slice(1)} ` : ''}profile photos are managed by your sign-in provider.`
    : profile?.provider
      ? `${profile.provider[0].toUpperCase()}${profile.provider.slice(1)} profile photos are managed by your sign-in provider.`
      : 'Add a profile photo from your connected sign-in provider.';

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><SettingsHeader title="Edit Profile" onBack={() => router.back()} rightAction={<Pressable accessibilityRole="button" disabled={loading || saving || !dirty} onPress={() => void save()}><Text style={{ color: loading || saving || !dirty ? colors.muted : colors.accent, fontWeight: '900' }}>Save</Text></Pressable>} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.content}>
    {loading ? <View style={s.loadingState}><ActivityIndicator color={colors.accent} /><Text style={[s.stateText, { color: colors.muted }]}>Loading your profile...</Text></View> : loadError ? <View style={s.loadingState}><Text style={[s.error, { color: colors.danger }]}>Unable to load your profile.</Text><Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={[s.retry, { color: colors.accent }]}>Retry</Text></Pressable></View> : profile ? <>
      <View style={s.profile}>{profile.avatarUrl ? <Image source={{ uri: profile.avatarUrl }} style={s.avatar} /> : <View style={s.avatarFallback}><Text style={s.initials}>{getProfileInitials(profile.name)}</Text></View>}<Text style={s.backNote}>{providerCopy}</Text></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Name</Text><TextInput value={name} onChangeText={(value) => { setName(value); setSaveError(''); }} placeholder="Your name" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: colors.input, borderColor: colors.line, color: colors.ink }]} /></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Email address</Text><TextInput value={profile.email} editable={false} style={[s.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.line, color: colors.muted }]} /></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Phone number</Text><TextInput value={phone} onChangeText={(value) => { setPhone(value); setSaveError(''); }} placeholder="Optional" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={[s.input, { backgroundColor: colors.input, borderColor: colors.line, color: colors.ink }]} /></View>
      {saveError ? <Text style={s.error}>{saveError}</Text> : null}{saved ? <Text style={s.success}>Profile updated.</Text> : null}
    </> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
