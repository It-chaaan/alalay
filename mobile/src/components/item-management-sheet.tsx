import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Trash2, X } from 'lucide-react-native';

import { formPalette } from './finance-form';

type ItemManagementSheetProps = {
  visible: boolean;
  title: string;
  itemName: string;
  deleteDescription: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  deleting?: boolean;
  error?: string;
};

export function ItemManagementSheet({ visible, title, itemName, deleteDescription, onClose, onEdit, onDelete, deleting = false, error = '' }: ItemManagementSheetProps) {
  const [confirming, setConfirming] = useState(false);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.overlay}><Pressable style={styles.backdrop} onPress={onClose} /><View style={confirming ? styles.confirmSheet : styles.sheet}>{confirming ? <><View style={styles.titleRow}><View><Text style={styles.eyebrow}>CONFIRM DELETE</Text><Text style={styles.title}>Delete {itemName}?</Text></View><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><X size={20} color={formPalette.ink} /></Pressable></View><Text style={styles.description}>{deleteDescription}</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.confirmActions}><Pressable disabled={deleting} onPress={() => setConfirming(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable><Pressable disabled={deleting} onPress={() => void onDelete()} style={[styles.deleteButton, deleting && styles.disabled]}>{deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.deleteText}>Delete</Text>}</Pressable></View></> : <><View style={styles.titleRow}><View><Text style={styles.eyebrow}>{title.toUpperCase()}</Text><Text style={styles.title}>{itemName}</Text></View><Pressable accessibilityLabel="Close" onPress={onClose} style={styles.close}><X size={20} color={formPalette.ink} /></Pressable></View><Pressable accessibilityRole="button" onPress={() => { onClose(); onEdit(); }} style={styles.action}><Pencil size={18} color={formPalette.ink} /><Text style={styles.actionText}>Edit {title.toLowerCase()}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setConfirming(true)} style={styles.deleteAction}><Trash2 size={18} color={formPalette.danger} /><Text style={styles.deleteActionText}>Delete {title.toLowerCase()}</Text></Pressable><Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelAction}><Text style={styles.cancelText}>Cancel</Text></Pressable></>}</View></View></Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' }, backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,35,28,0.28)' }, sheet: { padding: 20, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: formPalette.surface }, confirmSheet: { margin: 20, padding: 20, borderRadius: 22, backgroundColor: formPalette.surface }, titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, eyebrow: { color: formPalette.accent, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 }, title: { marginTop: 4, color: formPalette.ink, fontSize: 20, fontWeight: '900' }, close: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: formPalette.background }, action: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 52, marginTop: 18, paddingHorizontal: 12, borderRadius: 14, backgroundColor: formPalette.background }, actionText: { color: formPalette.ink, fontSize: 14, fontWeight: '800' }, deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 52, marginTop: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FCE8E6' }, deleteActionText: { color: formPalette.danger, fontSize: 14, fontWeight: '900' }, cancelAction: { alignItems: 'center', padding: 14 }, cancelButton: { paddingHorizontal: 14, paddingVertical: 11 }, cancelText: { color: formPalette.muted, fontWeight: '900' }, description: { marginTop: 11, color: formPalette.muted, fontSize: 13, lineHeight: 20 }, error: { marginTop: 10, color: formPalette.danger, fontSize: 12, fontWeight: '800' }, confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }, deleteButton: { minWidth: 86, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 11, borderRadius: 16, backgroundColor: formPalette.danger }, deleteText: { color: '#FFFFFF', fontWeight: '900' }, disabled: { opacity: 0.5 },
});
