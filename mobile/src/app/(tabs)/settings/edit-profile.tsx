import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsHeader, useSettingsStyles } from '@/components/settings-ui';
import { useCurrentProfile } from '@/hooks/use-current-profile';
import { removeCurrentAvatar, updateCurrentProfile, uploadCurrentAvatar } from '@/services/profile';
import { ProfileAvatar } from '@/components/profile-avatar';
import { useAppTheme } from '@/theme/theme';

export default function EditProfileScreen() {
  const { colors } = useAppTheme();
  const s = useSettingsStyles();
  const { profile, loading, error: loadError, retry } = useCurrentProfile();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  const providerCopy = profile?.avatarSource === 'uploaded'
    ? 'Your uploaded profile photo is private to your Alalay account.'
    : profile?.avatarSource === 'provider'
      ? `${profile.provider ? `${profile.provider[0].toUpperCase()}${profile.provider.slice(1)} ` : ''}profile photos are managed by your sign-in provider.`
    : profile?.provider
      ? `${profile.provider[0].toUpperCase()}${profile.provider.slice(1)} profile photos are managed by your sign-in provider.`
      : 'Add a profile photo from your connected sign-in provider.';

  const choosePhoto = async () => {
    if (uploading) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photo access needed', 'Allow photo access in device settings to choose a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.78 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType;
    if (mime !== 'image/jpeg' && mime !== 'image/png' && mime !== 'image/webp') { setSaveError('Choose a JPEG, PNG, or WebP image.'); return; }
    if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) { setSaveError('Choose an image smaller than 2 MB.'); return; }
    setUploading(true); setSaveError('');
    try { await uploadCurrentAvatar(asset.uri, mime); }
    catch { setSaveError('Your profile photo could not be saved. Please try another image.'); }
    finally { setUploading(false); }
  };
  const removePhoto = () => Alert.alert('Remove profile photo?', 'Your Google photo, if available, will be used instead.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { setUploading(true); void removeCurrentAvatar().catch(() => setSaveError('Your profile photo could not be removed.')).finally(() => setUploading(false)); } }]);

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><SettingsHeader title="Edit Profile" onBack={() => router.back()} rightAction={<Pressable accessibilityRole="button" disabled={loading || saving || !dirty} onPress={() => void save()}><Text style={{ color: loading || saving || !dirty ? colors.muted : colors.accent, fontWeight: '900' }}>Save</Text></Pressable>} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={s.content}>
    {loading ? <View style={s.loadingState}><ActivityIndicator color={colors.accent} /><Text style={[s.stateText, { color: colors.muted }]}>Loading your profile...</Text></View> : loadError ? <View style={s.loadingState}><Text style={[s.error, { color: colors.danger }]}>Unable to load your profile.</Text><Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={[s.retry, { color: colors.accent }]}>Retry</Text></Pressable></View> : profile ? <>
      <View style={s.profile}><ProfileAvatar name={profile.name} url={profile.avatarUrl} size={88} color={colors.accent} /><View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}><Pressable disabled={uploading} onPress={() => void choosePhoto()}><Text style={{ color: colors.accent, fontWeight: '800' }}>{uploading ? 'Saving photo…' : 'Choose photo'}</Text></Pressable>{profile.avatarSource === 'uploaded' ? <Pressable disabled={uploading} onPress={removePhoto}><Text style={{ color: colors.danger, fontWeight: '800' }}>Remove photo</Text></Pressable> : null}</View><Text style={s.backNote}>{providerCopy}</Text></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Name</Text><TextInput value={name} onChangeText={(value) => { setName(value); setSaveError(''); }} placeholder="Your name" placeholderTextColor={colors.subtle} style={[s.input, { backgroundColor: colors.input, borderColor: colors.line, color: colors.ink }]} /></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Email address</Text><TextInput value={profile.email} editable={false} style={[s.input, { backgroundColor: colors.surfaceSecondary, borderColor: colors.line, color: colors.muted }]} /></View>
      <View style={s.field}><Text style={[s.formLabel, { color: colors.ink }]}>Phone number</Text><TextInput value={phone} onChangeText={(value) => { setPhone(value); setSaveError(''); }} placeholder="Optional" placeholderTextColor={colors.subtle} keyboardType="phone-pad" style={[s.input, { backgroundColor: colors.input, borderColor: colors.line, color: colors.ink }]} /></View>
      {saveError ? <Text style={s.error}>{saveError}</Text> : null}{saved ? <Text style={s.success}>Profile updated.</Text> : null}
    </> : null}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
