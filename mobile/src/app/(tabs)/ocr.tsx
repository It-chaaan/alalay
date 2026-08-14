import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Check, ImagePlus, ScanLine, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseCategoryPicker, FormTextInput, DatePickerField, parseAmount } from '@/components/finance-form';
import { WalletPickerModal, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import { dateKeyInManila, fetchWallets, notifyFinancialMutation } from '@/services/finance';
import { scanReceiptImage, type ReceiptCandidate } from '@/services/mobile-ocr';
import { useAppTheme } from '@/theme/theme';
import { useToast } from '@/components/toast-provider';

type LocalImage = { uri: string; mimeType?: string | null };
type Stage = 'camera' | 'preview' | 'review';

export default function OcrScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('camera');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<LocalImage | null>(null);
  const [candidate, setCandidate] = useState<ReceiptCandidate | null>(null);
  const [rawText, setRawText] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  const setPreview = (image: LocalImage) => { setPhoto(image); setCandidate(null); setRawText(''); setError(''); setStage('preview'); };
  const capture = async () => {
    if (processing || !cameraRef.current) return;
    setError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      if (!captured?.uri) throw new Error('The camera did not return an image.');
      setPreview({ uri: captured.uri, mimeType: 'image/jpeg' });
    } catch { setError('We could not capture that receipt. Please try again.'); }
  };
  const chooseImage = async () => {
    if (processing) return;
    setError('');
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
    if (!selected.canceled && selected.assets[0]) setPreview({ uri: selected.assets[0].uri, mimeType: selected.assets[0].mimeType });
  };
  const scan = async () => {
    if (!photo || processing) return;
    setProcessing(true); setError('');
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const result = await scanReceiptImage(photo, controller.signal);
      setCandidate(result.receipt);
      setRawText(result.ocr.rawText);
      try { setWallets((await fetchWallets()) as Wallet[]); } catch { setWallets([]); }
      setStage('review');
    } catch (scanError) {
      if ((scanError as Error).name !== 'AbortError') setError(scanError instanceof Error ? scanError.message : "We couldn't read this receipt. Try again.");
    } finally { if (abortRef.current === controller) abortRef.current = null; setProcessing(false); }
  };
  const retake = () => { abortRef.current?.abort(); setPhoto(null); setCandidate(null); setRawText(''); setError(''); setStage('camera'); };
  const manual = () => router.replace('/(tabs)/expenses');

  if (stage === 'review' && candidate && photo) return <ReceiptReview candidate={candidate} rawText={rawText} photoUri={photo.uri} wallets={wallets} onRetake={() => setStage('preview')} onDone={() => router.back()} />;
  if (!permission) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!permission.granted) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><Header title="Scan receipt" onBack={() => router.back()} colors={colors} /><View style={styles.center}><Camera size={34} color={colors.primary} /><Text style={[styles.title, { color: colors.textPrimary }]}>Camera access needed</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Allow camera access to capture a receipt, or choose one from your library.</Text><Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Allow camera</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void chooseImage()}><Text style={[styles.link, { color: colors.primary }]}>Choose from library</Text></Pressable></View></SafeAreaView>;
  if (stage === 'preview' && photo) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><Header title="Receipt preview" onBack={retake} colors={colors} /><ScrollView contentContainerStyle={styles.previewScreen}><Image source={{ uri: photo.uri }} style={styles.preview} /><Text style={[styles.copy, { color: colors.textSecondary }]}>Check that the receipt is clear before scanning. Nothing is saved yet.</Text>{error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}{processing ? <View style={styles.processing}><ActivityIndicator color={colors.primary} /><Text style={[styles.copy, { color: colors.textSecondary }]}>Scanning receipt… This may take a moment.</Text></View> : <><Pressable accessibilityRole="button" accessibilityLabel="Scan receipt" onPress={() => void scan()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><ScanLine size={19} color={colors.textOnPrimary} /><Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Scan receipt</Text></Pressable><Pressable accessibilityRole="button" onPress={retake}><Text style={[styles.link, { color: colors.primary }]}>Retake photo</Text></Pressable><Pressable accessibilityRole="button" onPress={() => void chooseImage()}><Text style={[styles.link, { color: colors.primary }]}>Choose another photo</Text></Pressable><Pressable accessibilityRole="button" onPress={manual}><Text style={[styles.link, { color: colors.primary }]}>Enter details manually</Text></Pressable></>}</ScrollView></SafeAreaView>;
  return <View style={styles.cameraScreen}><CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" autofocus="on" flash="off" onMountError={() => setError('Camera unavailable. Choose a photo instead.')} /><View style={styles.cameraShade} /><SafeAreaView style={styles.cameraSafe} edges={['top', 'bottom']}><View style={styles.cameraHeader}><Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={() => router.back()} style={styles.roundButton}><X size={22} color="#fff" /></Pressable><Text style={styles.cameraTitle}>Scan receipt</Text><View style={styles.roundButton} /></View><View style={styles.frame}><Text style={styles.frameText}>Fit the full receipt inside the frame</Text></View><View style={[styles.cameraBottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>{error ? <Text style={styles.cameraError}>{error}</Text> : null}<View style={styles.cameraActions}><Pressable accessibilityRole="button" accessibilityLabel="Choose receipt photo" onPress={() => void chooseImage()} style={styles.libraryButton}><ImagePlus size={22} color="#fff" /></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Capture receipt" onPress={() => void capture()} style={styles.captureButton}><ScanLine size={28} color="#12382A" /></Pressable><View style={styles.libraryButton} /></View></View></SafeAreaView></View>;
}

function Header({ title, onBack, colors }: { title: string; onBack: () => void; colors: ReturnType<typeof useAppTheme>['colors'] }) { return <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.headerBack}><ArrowLeft size={22} color={colors.textPrimary} /></Pressable><Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text></View>; }

function ReceiptReview({ candidate, rawText, photoUri, wallets, onRetake, onDone }: { candidate: ReceiptCandidate; rawText: string; photoUri: string; wallets: Wallet[]; onRetake: () => void; onDone: () => void }) {
  const { colors } = useAppTheme(); const toast = useToast();
  const [merchant, setMerchant] = useState(candidate.merchant ?? ''); const [amount, setAmount] = useState(candidate.total === null ? '' : String(candidate.total)); const [date, setDate] = useState(candidate.date ?? dateKeyInManila()); const [category, setCategory] = useState(candidate.suggestedCategory ?? 'Other'); const [walletId, setWalletId] = useState<string | null>(null); const [walletOpen, setWalletOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId); const [showRawText, setShowRawText] = useState(false);
  const confirm = async () => { const value = parseAmount(amount); if (!merchant.trim() || value === null || value <= 0) { setError('Check the merchant and amount before saving.'); return; } if (!walletId) { setError('Choose the wallet used for this receipt.'); return; } setSaving(true); setError(''); try { await authenticatedApiRequest('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant: merchant.trim(), amount: value, category, categories: [category], date, wallet_id: walletId }) }); notifyFinancialMutation(); toast.success('Expense added'); onDone(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'The receipt could not be saved. Your review is still here.'); } finally { setSaving(false); } };
  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><Header title="Review receipt" onBack={onRetake} colors={colors} /><ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled"><Image source={{ uri: photoUri }} style={styles.preview} /><Text style={[styles.reviewHint, { color: colors.textSecondary }]}>Review the extracted values. Nothing is saved until you confirm.</Text><FormTextInput label="Merchant" placeholder="Review required" value={merchant} onChangeText={setMerchant} /><FormTextInput label="Amount" placeholder="Review required" value={amount} onChangeText={setAmount} /><DatePickerField label="Date" value={date} onChange={setDate} compact /><ExpenseCategoryPicker value={category} onChange={setCategory} /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Paid from</Text><Pressable accessibilityRole="button" accessibilityLabel="Choose wallet" onPress={() => setWalletOpen(true)} style={[styles.walletButton, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}><Text style={[styles.walletText, { color: selectedWallet ? colors.textPrimary : colors.textMuted }]}>{selectedWallet?.name ?? 'Select wallet'}</Text><Text style={{ color: colors.textSecondary }}>›</Text></Pressable><WalletPickerModal visible={walletOpen} wallets={wallets} onClose={() => setWalletOpen(false)} onChange={(id) => { setWalletId(id); setWalletOpen(false); }} allowUnset={false} />{candidate.lineItems.length ? <View style={[styles.itemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemsTitle, { color: colors.textPrimary }]}>Recognized items</Text>{candidate.lineItems.map((item, index) => <View key={`${item.description}-${index}`} style={styles.itemRow}><Text style={[styles.itemName, { color: colors.textSecondary }]}>{item.description}</Text><Text style={[styles.itemAmount, { color: colors.textPrimary }]}>₱{item.amount.toFixed(2)}</Text></View>)}</View> : null}{rawText ? <View style={styles.rawText}><Pressable accessibilityRole="button" onPress={() => setShowRawText((value) => !value)}><Text style={{ color: colors.primary, fontWeight: '800' }}>{showRawText ? 'Hide scanned text' : 'View scanned text'}</Text></Pressable>{showRawText ? <Text selectable style={{ color: colors.textSecondary, marginTop: 8, fontSize: 12 }}>{rawText}</Text> : null}</View> : null}{error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirm()} style={[styles.confirmButton, { backgroundColor: colors.primary }, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <><Check size={19} color={colors.textOnPrimary} /><Text style={[styles.confirmText, { color: colors.textOnPrimary }]}>Save expense</Text></>}</Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 }, headerBack: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, headerTitle: { marginLeft: 8, fontSize: 22, fontWeight: '900' }, title: { marginTop: 16, fontSize: 20, fontWeight: '900', textAlign: 'center' }, copy: { maxWidth: 330, marginTop: 10, fontSize: 14, lineHeight: 21, textAlign: 'center' }, primaryButton: { minHeight: 52, marginTop: 20, paddingHorizontal: 24, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 26 }, primaryButtonText: { fontWeight: '900' }, link: { marginTop: 16, fontWeight: '800', textAlign: 'center' }, cameraScreen: { flex: 1, backgroundColor: '#000' }, cameraSafe: { flex: 1, justifyContent: 'space-between' }, cameraShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' }, cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 }, roundButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)' }, cameraTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, frame: { alignSelf: 'center', width: '82%', height: '58%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.86)', borderRadius: 12 }, frameText: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, overflow: 'hidden', color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', fontSize: 12, fontWeight: '700' }, cameraBottom: { alignItems: 'center', minHeight: 115, justifyContent: 'center' }, cameraActions: { flexDirection: 'row', alignItems: 'center', gap: 28 }, captureButton: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#fff', borderRadius: 36, backgroundColor: '#D8EFE2' }, libraryButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, cameraError: { maxWidth: 340, marginBottom: 12, color: '#FFD8D5', textAlign: 'center', fontWeight: '700' }, previewScreen: { padding: 20, paddingBottom: 42, alignItems: 'stretch' }, preview: { width: '100%', height: 220, borderRadius: 18, backgroundColor: '#202428', resizeMode: 'contain' }, processing: { alignItems: 'center', marginTop: 24 }, reviewContent: { padding: 20, paddingBottom: 40 }, reviewHint: { marginTop: 10, fontSize: 13, lineHeight: 19 }, fieldLabel: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '900' }, walletButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderRadius: 17 }, walletText: { fontSize: 15, fontWeight: '800' }, itemsCard: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 17 }, itemsTitle: { marginBottom: 8, fontSize: 14, fontWeight: '900' }, itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }, itemName: { flex: 1, marginRight: 12, fontSize: 13 }, itemAmount: { fontSize: 13, fontWeight: '800' }, rawText: { marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: 'rgba(128,128,128,0.10)' }, error: { marginTop: 14, fontSize: 13, fontWeight: '700', textAlign: 'center' }, confirmButton: { minHeight: 56, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28 }, confirmText: { fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.6 } });
