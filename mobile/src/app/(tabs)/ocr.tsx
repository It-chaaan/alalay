import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraCapturedPicture } from 'expo-camera';
import { router } from 'expo-router';
import { ArrowLeft, Camera, Check, RotateCcw, ScanLine, X } from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExpenseCategoryPicker, FormTextInput, DatePickerField, parseAmount } from '@/components/finance-form';
import { WalletPickerModal, type Wallet } from '@/components/wallet-picker';
import { authenticatedApiRequest } from '@/services/api';
import { dateKeyInManila, fetchWallets, notifyFinancialMutation } from '@/services/finance';
import { parseReceipt, candidateDate, type ReceiptCandidate } from '@/services/receipt-parser';
import { processMobileReceipt, recognizeReceiptText } from '@/services/mobile-ocr';
import { useAppTheme } from '@/theme/theme';

type Stage = 'camera' | 'review';

export default function OcrScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('camera');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [candidate, setCandidate] = useState<ReceiptCandidate | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);

  const cameraRef = useRef<CameraView>(null);

  const capture = async () => {
    if (processing || !cameraRef.current) return;
    setProcessing(true);
    setError('');
    try {
      const captured = await cameraRef.current.takePictureAsync({ quality: 1, skipProcessing: false });
      if (!captured?.uri) throw new Error('The camera did not return an image.');
      setPhoto(captured);
      const recognized = await recognizeReceiptText(captured.uri);
      if (!recognized.text.trim()) {
        setError('I could not read enough text. Keep the receipt flat, well lit, and in focus, then try again.');
        return;
      }
      let parsed: ReceiptCandidate;
      try {
        parsed = await processMobileReceipt(recognized);
      } catch {
        // The image and OCR text stay local; a temporary API outage should not
        // erase the reviewable result. Persistence still goes through the API.
        parsed = parseReceipt(recognized);
      }
      setCandidate(parsed);
      try {
        setWallets((await fetchWallets()) as Wallet[]);
      } catch {
        // Keep the OCR result reviewable if the wallet query is temporarily
        // unavailable; saving will still require an authenticated wallet.
        setWallets([]);
      }
      setStage('review');
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Receipt recognition is unavailable. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const retake = () => { setPhoto(null); setCandidate(null); setError(''); setStage('camera'); };

  if (stage === 'review' && candidate && photo) {
    return <ReceiptReview candidate={candidate} photoUri={photo.uri} wallets={wallets} onRetake={retake} onDone={() => router.back()} />;
  }

  if (!permission) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  if (!permission.granted) return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}><Header title="Scan receipt" onBack={() => router.back()} colors={colors} /><View style={styles.center}><View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Camera size={34} color={colors.primary} /></View><Text style={[styles.title, { color: colors.textPrimary }]}>Camera access needed</Text><Text style={[styles.copy, { color: colors.textSecondary }]}>Allow camera access to read receipts securely on your device.</Text><Pressable accessibilityRole="button" onPress={() => void requestPermission()} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.textOnPrimary }]}>Allow camera</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={[styles.link, { color: colors.primary }]}>Go back</Text></Pressable></View></SafeAreaView>;

  return <View style={styles.cameraScreen}><CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" autofocus="on" flash="off" onMountError={(mountError) => setError(`Camera unavailable: ${mountError.message}`)} /><View style={styles.cameraShade} /><SafeAreaView style={styles.cameraSafe} edges={['top', 'bottom']}><View style={styles.cameraHeader}><Pressable accessibilityRole="button" accessibilityLabel="Close scanner" onPress={() => router.back()} style={styles.roundButton}><X size={22} color="#fff" /></Pressable><Text style={styles.cameraTitle}>Scan receipt</Text><View style={styles.roundButton} /></View><View style={styles.frame}><Text style={styles.frameText}>Fit the full receipt inside the frame</Text></View><View style={[styles.cameraBottom, { paddingBottom: Math.max(insets.bottom, 18) }]}>{error ? <Text style={styles.cameraError}>{error}</Text> : null}{processing ? <><ActivityIndicator color="#fff" size="large" /><Text style={styles.processingText}>Reading receipt on device…</Text></> : <Pressable accessibilityRole="button" accessibilityLabel="Capture receipt" onPress={() => void capture()} style={styles.captureButton}><ScanLine size={28} color="#12382A" /></Pressable>}</View></SafeAreaView></View>;
}

function Header({ title, onBack, colors }: { title: string; onBack: () => void; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  return <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.headerBack}><ArrowLeft size={22} color={colors.textPrimary} /></Pressable><Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{title}</Text></View>;
}

function ReceiptReview({ candidate, photoUri, wallets, onRetake, onDone }: { candidate: ReceiptCandidate; photoUri: string; wallets: Wallet[]; onRetake: () => void; onDone: () => void }) {
  const { colors } = useAppTheme();
  const [merchant, setMerchant] = useState(candidate.merchant);
  const [amount, setAmount] = useState(candidate.total === null ? '' : String(candidate.total));
  const [date, setDate] = useState(candidateDate(candidate));
  const [category, setCategory] = useState('Groceries');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);

  const confirm = async () => {
    const value = parseAmount(amount);
    if (!merchant.trim() || value === null || value <= 0) { setError('Check the merchant and amount before saving.'); return; }
    if (!walletId) { setError('Choose the wallet used for this receipt.'); return; }
    setSaving(true); setError('');
    try {
      await authenticatedApiRequest('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ merchant: merchant.trim(), amount: value, category, categories: [category], date, wallet_id: walletId }) });
      notifyFinancialMutation();
      onDone();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'The receipt could not be saved. Your review is still here.');
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}><Header title="Review receipt" onBack={onRetake} colors={colors} /><ScrollView contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled"><Image source={{ uri: photoUri }} style={styles.preview} /><Text style={[styles.reviewHint, { color: colors.textSecondary }]}>Review the extracted values. Nothing is saved until you confirm.</Text><FormTextInput label="Merchant" placeholder="Merchant name" value={merchant} onChangeText={setMerchant} /><FormTextInput label="Amount" placeholder="0.00" value={amount} onChangeText={setAmount} /><DatePickerField label="Date" value={date || dateKeyInManila()} onChange={setDate} compact /><ExpenseCategoryPicker value={category} onChange={setCategory} /><Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Wallet</Text><Pressable accessibilityRole="button" accessibilityLabel={`Choose wallet${selectedWallet ? `, ${selectedWallet.name}` : ''}`} onPress={() => setWalletOpen(true)} style={[styles.walletButton, { backgroundColor: colors.surfaceInput, borderColor: colors.border }]}><Text style={[styles.walletText, { color: selectedWallet ? colors.textPrimary : colors.textMuted }]}>{selectedWallet?.name ?? 'Select wallet'}</Text><Text style={{ color: colors.textSecondary }}>›</Text></Pressable><WalletPickerModal visible={walletOpen} wallets={wallets} onClose={() => setWalletOpen(false)} onChange={(id) => { setWalletId(id); setWalletOpen(false); }} allowUnset={false} />{candidate.items.length ? <View style={[styles.itemsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.itemsTitle, { color: colors.textPrimary }]}>Recognized items</Text>{candidate.items.map((item, index) => <View key={`${item.description}-${index}`} style={styles.itemRow}><Text style={[styles.itemName, { color: colors.textSecondary }]}>{item.description}</Text><Text style={[styles.itemAmount, { color: colors.textPrimary }]}>₱{item.amount.toFixed(2)}</Text></View>)}</View> : null}{error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}<Pressable accessibilityRole="button" disabled={saving} onPress={() => void confirm()} style={[styles.confirmButton, { backgroundColor: colors.primary }, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.textOnPrimary} /> : <><Check size={19} color={colors.textOnPrimary} /><Text style={[styles.confirmText, { color: colors.textOnPrimary }]}>Add expense</Text></>}</Pressable><Pressable accessibilityRole="button" disabled={saving} onPress={onRetake} style={styles.retake}><RotateCcw size={17} color={colors.primary} /><Text style={[styles.retakeText, { color: colors.primary }]}>Retake receipt</Text></Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 }, headerBack: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 }, headerTitle: { marginLeft: 8, fontSize: 22, fontWeight: '900' }, icon: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center', borderRadius: 35 }, title: { marginTop: 16, fontSize: 20, fontWeight: '900', textAlign: 'center' }, copy: { maxWidth: 300, marginTop: 8, fontSize: 14, lineHeight: 21, textAlign: 'center' }, primaryButton: { minHeight: 50, marginTop: 20, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 25 }, primaryButtonText: { fontWeight: '900' }, link: { marginTop: 18, fontWeight: '800' }, cameraScreen: { flex: 1, backgroundColor: '#000' }, cameraSafe: { flex: 1, justifyContent: 'space-between' }, cameraShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' }, cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8 }, roundButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.5)' }, cameraTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, frame: { alignSelf: 'center', width: '82%', height: '58%', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.86)', borderRadius: 12 }, frameText: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, overflow: 'hidden', color: '#fff', backgroundColor: 'rgba(0,0,0,0.55)', fontSize: 12, fontWeight: '700' }, cameraBottom: { alignItems: 'center', minHeight: 115, justifyContent: 'center' }, captureButton: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#fff', borderRadius: 36, backgroundColor: '#D8EFE2' }, processingText: { marginTop: 10, color: '#fff', fontWeight: '800' }, cameraError: { maxWidth: 340, marginBottom: 12, color: '#FFD8D5', textAlign: 'center', fontWeight: '700' }, reviewContent: { padding: 20, paddingBottom: 40 }, preview: { width: '100%', height: 180, borderRadius: 18, backgroundColor: '#202428', resizeMode: 'contain' }, reviewHint: { marginTop: 10, fontSize: 13, lineHeight: 19 }, fieldLabel: { marginTop: 16, marginBottom: 8, fontSize: 11, fontWeight: '900' }, walletButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderRadius: 17 }, walletText: { fontSize: 15, fontWeight: '800' }, itemsCard: { marginTop: 18, padding: 16, borderWidth: 1, borderRadius: 17 }, itemsTitle: { marginBottom: 8, fontSize: 14, fontWeight: '900' }, itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }, itemName: { flex: 1, marginRight: 12, fontSize: 13 }, itemAmount: { fontSize: 13, fontWeight: '800' }, error: { marginTop: 14, fontSize: 13, fontWeight: '700' }, confirmButton: { minHeight: 56, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 28 }, confirmText: { fontSize: 15, fontWeight: '900' }, retake: { minHeight: 48, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, retakeText: { fontWeight: '900' }, disabled: { opacity: 0.6 },
});
